const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { env } = require('../config/env');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadPdf, pdfDir } = require('../middleware/upload');

const router = express.Router();

/**
 * GET /api/lectures/course/:courseId
 * List lectures for a course
 */
router.get('/course/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;

    if (req.user.role === 'student') {
      const en = await pool.query(
        'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [req.user.id, courseId]
      );
      if (en.rows.length === 0) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
      }
    }

    const result = await pool.query(
      `SELECT l.id, l.course_id, l.title, l.title_ar, l.sort_order, l.created_at,
              EXISTS (
                SELECT 1 FROM lecture_logs ll
                WHERE ll.lecture_id = l.id AND ll.student_id = $1
              ) AS viewed
       FROM lectures l
       WHERE l.course_id = $2
       ORDER BY l.sort_order ASC, l.created_at ASC`,
      [req.user.id, courseId]
    );

    res.json({ lectures: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/lectures
 * Upload new lecture PDF (both super_admin and assistant admin allowed)
 */
router.post('/', authenticate, requireAdmin, uploadPdf.single('pdf'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const { course_id, title, title_ar, sort_order } = req.body;
    if (!course_id || !title) {
      // Clean up uploaded file if validation fails
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'course_id and title are required' });
    }

    // Relative path or filename
    const relativePath = path.basename(req.file.path);

    await client.query('BEGIN');

    const insertRes = await client.query(
      `INSERT INTO lectures (course_id, title, title_ar, pdf_path, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, course_id, title, title_ar, pdf_path, sort_order, created_at`,
      [course_id, title, title_ar || '', relativePath, parseInt(sort_order, 10) || 0]
    );

    const lecture = insertRes.rows[0];

    // Get course info for notification
    const courseRes = await client.query('SELECT title, title_ar FROM courses WHERE id = $1', [course_id]);
    const courseTitle = courseRes.rows[0]?.title || '';
    const courseTitleAr = courseRes.rows[0]?.title_ar || courseTitle;

    // Notify enrolled students
    await client.query(
      `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
       SELECT en.student_id, 'pdf_published',
         'New PDF Lecture: ' || $1,
         'محاضرة جديدة: ' || $2,
         'New lecture "' || $1 || '" was uploaded to ' || $3,
         'تم رفع محاضرة جديدة "' || $2 || '" في مادة ' || $4
       FROM enrollments en
       WHERE en.course_id = $5`,
      [title, title_ar || title, courseTitle, courseTitleAr, course_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ lecture });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * GET /api/lectures/:id/pdf
 * View inline PDF (VIEW ONLY, no download header)
 */
router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const lectureRes = await pool.query(
      'SELECT id, course_id, title, title_ar, pdf_path FROM lectures WHERE id = $1',
      [req.params.id]
    );

    if (lectureRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lecture not found' });
    }

    const lecture = lectureRes.rows[0];

    // If student, verify enrollment
    if (req.user.role === 'student') {
      const en = await pool.query(
        'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [req.user.id, lecture.course_id]
      );
      if (en.rows.length === 0) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
      }

      // Log student view action
      await pool.query(
        'INSERT INTO lecture_logs (student_id, lecture_id, action) VALUES ($1, $2, $3)',
        [req.user.id, lecture.id, 'view']
      );
    }

    const filePath = path.join(pdfDir, path.basename(lecture.pdf_path));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found on disk' });
    }

    // Set secure view-only headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="lecture.pdf"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Nginx internal acceleration if present
    if (req.headers['x-accel-support'] === 'yes') {
      res.setHeader('X-Accel-Redirect', `/uploads/pdfs/${path.basename(lecture.pdf_path)}`);
      return res.end();
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/lectures/:id
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const lectureRes = await pool.query('SELECT pdf_path FROM lectures WHERE id = $1', [req.params.id]);
    if (lectureRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lecture not found' });
    }

    const filename = path.basename(lectureRes.rows[0].pdf_path);
    const filePath = path.join(pdfDir, filename);

    await pool.query('DELETE FROM lectures WHERE id = $1', [req.params.id]);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }

    res.json({ message: 'Lecture deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
