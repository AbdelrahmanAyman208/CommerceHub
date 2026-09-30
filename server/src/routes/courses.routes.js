const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireAdmin, requireStudent } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createCourseSchema, updateCourseSchema, enrollStudentsSchema } = require('../schemas/course.schema');

const router = express.Router();

/**
 * GET /api/courses
 * List courses (accessible by authenticated users)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      // Return student's enrolled courses with lecture and exam counts
      const result = await pool.query(
        `SELECT c.id, c.title, c.title_ar, c.description, c.description_ar,
                COUNT(DISTINCT l.id)::int AS lectures_count,
                COUNT(DISTINCT e.id) FILTER (WHERE e.published = true)::int AS exams_count
         FROM courses c
         JOIN enrollments en ON c.id = en.course_id
         LEFT JOIN lectures l ON c.id = l.course_id
         LEFT JOIN exams e ON c.id = e.course_id
         WHERE en.student_id = $1
         GROUP BY c.id
         ORDER BY c.title ASC`,
        [req.user.id]
      );
      return res.json({ courses: result.rows });
    }

    // Admin/super_admin: get all courses with stats
    const result = await pool.query(
      `SELECT c.id, c.title, c.title_ar, c.description, c.description_ar, c.created_at,
              COUNT(DISTINCT en.student_id)::int AS enrolled_students_count,
              COUNT(DISTINCT l.id)::int AS lectures_count,
              COUNT(DISTINCT e.id)::int AS exams_count
       FROM courses c
       LEFT JOIN enrollments en ON c.id = en.course_id
       LEFT JOIN lectures l ON c.id = l.course_id
       LEFT JOIN exams e ON c.id = e.course_id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    res.json({ courses: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/courses/:id
 * Get single course with enrolled students and lectures
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const courseRes = await pool.query(
      'SELECT id, title, title_ar, description, description_ar, created_at FROM courses WHERE id = $1',
      [req.params.id]
    );

    if (courseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseRes.rows[0];

    // If student, check enrollment
    if (req.user.role === 'student') {
      const enRes = await pool.query(
        'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [req.user.id, course.id]
      );
      if (enRes.rows.length === 0) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
      }
    }

    const [lecturesRes, enrolledRes] = await Promise.all([
      pool.query(
        'SELECT id, title, title_ar, sort_order, created_at FROM lectures WHERE course_id = $1 ORDER BY sort_order ASC, created_at ASC',
        [course.id]
      ),
      req.user.role !== 'student'
        ? pool.query(
            `SELECT u.id, u.student_id, u.name, u.email, en.created_at AS enrolled_at
             FROM users u
             JOIN enrollments en ON u.id = en.student_id
             WHERE en.course_id = $1
             ORDER BY u.name ASC`,
            [course.id]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      course,
      lectures: lecturesRes.rows,
      enrolledStudents: enrolledRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/courses
 * Create course (Admin / Assistant / Doctor)
 */
router.post('/', authenticate, requireAdmin, validate(createCourseSchema), async (req, res, next) => {
  try {
    const { title, title_ar, description, description_ar } = req.body;
    const result = await pool.query(
      `INSERT INTO courses (title, title_ar, description, description_ar)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, title_ar, description, description_ar, created_at`,
      [title, title_ar || '', description || '', description_ar || '']
    );
    res.status(201).json({ course: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/courses/:id
 */
router.put('/:id', authenticate, requireAdmin, validate(updateCourseSchema), async (req, res, next) => {
  try {
    const { title, title_ar, description, description_ar } = req.body;
    const updates = [];
    const params = [req.params.id];

    if (title !== undefined) {
      params.push(title);
      updates.push(`title = $${params.length}`);
    }
    if (title_ar !== undefined) {
      params.push(title_ar);
      updates.push(`title_ar = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description);
      updates.push(`description = $${params.length}`);
    }
    if (description_ar !== undefined) {
      params.push(description_ar);
      updates.push(`description_ar = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `
      UPDATE courses
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, title_ar, description, description_ar, updated_at
    `;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ course: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/courses/:id
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/courses/:id/enroll
 * Enroll one or more students
 */
router.post('/:id/enroll', authenticate, requireAdmin, validate(enrollStudentsSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { student_ids } = req.body;
    const courseId = req.params.id;

    await client.query('BEGIN');

    let enrolledCount = 0;
    for (const sid of student_ids) {
      const ins = await client.query(
        `INSERT INTO enrollments (student_id, course_id)
         VALUES ($1, $2)
         ON CONFLICT (student_id, course_id) DO NOTHING
         RETURNING id`,
        [sid, courseId]
      );
      if (ins.rows.length > 0) enrolledCount++;
    }

    await client.query('COMMIT');
    res.json({ message: `Successfully enrolled ${enrolledCount} students`, enrolledCount });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/courses/:id/enroll/:studentId
 * Unenroll student from course
 */
router.delete('/:id/enroll/:studentId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM enrollments WHERE course_id = $1 AND student_id = $2 RETURNING id',
      [req.params.id, req.params.studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({ message: 'Student unenrolled successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
