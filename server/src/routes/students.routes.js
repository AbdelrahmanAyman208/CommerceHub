const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { pool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createStudentSchema, updateStudentSchema } = require('../schemas/student.schema');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

const router = express.Router();
const uploadCsv = multer({ storage: multer.memoryStorage() });

// All routes require admin or super_admin
router.use(authenticate, requireAdmin);

/**
 * GET /api/admin/students
 * Paginated student list with search and stats
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;

    let countQuery = "SELECT COUNT(*) FROM users WHERE role = 'student'";
    let dataQuery = `
      SELECT u.id, u.email, u.student_id, u.name, u.password_changed, u.last_active_at, u.created_at,
             COUNT(DISTINCT e.course_id)::int AS enrolled_courses_count,
             COUNT(DISTINCT a.id)::int AS total_attempts,
             ROUND(COALESCE(AVG(a.score), 0), 2) AS average_score
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.student_id
      LEFT JOIN exam_attempts a ON u.id = a.student_id AND a.graded = true
      WHERE u.role = 'student'
    `;
    const params = [];

    if (search) {
      params.push(search);
      countQuery += ` AND (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1 OR student_id LIKE $1)`;
      dataQuery += ` AND (LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1 OR u.student_id LIKE $1)`;
    }

    dataQuery += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, search ? [search] : []),
      pool.query(dataQuery, params),
    ]);

    res.json(formatPaginatedResponse(dataRes.rows, countRes.rows[0].count, page, limit));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/students
 * Create single student with auto-generated 8-digit numeric ID
 */
router.post('/', validate(createStudentSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, email, password } = req.body;

    // Check unique email
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Auto-generate unique 8-digit ID from sequence
    const seqRes = await client.query("SELECT nextval('student_id_seq')::text AS next_id");
    const studentId = seqRes.rows[0].next_id.padStart(8, '0');

    // Default password to student ID if not provided
    const rawPassword = password || studentId;
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const insertRes = await client.query(
      `INSERT INTO users (email, student_id, name, password_hash, role, password_changed)
       VALUES ($1, $2, $3, $4, 'student', false)
       RETURNING id, email, student_id, name, role, password_changed, created_at`,
      [email, studentId, name, passwordHash]
    );

    res.status(201).json({
      student: insertRes.rows[0],
      initialPassword: rawPassword,
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/admin/students/import
 * Bulk CSV import with auto-generated 8-digit student IDs
 */
router.post('/import', uploadCsv.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  const client = await pool.connect();
  try {
    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    const created = [];
    const errors = [];

    await client.query('BEGIN');

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      // Support english and arabic headers
      const name = row.name || row.Name || row['الاسم'] || row['اسم الطالب'];
      const email = row.email || row.Email || row['البريد'] || row['البريد الإلكتروني'];
      const customPassword = row.password || row.Password;

      if (!name || !email) {
        errors.push({ row: i + 1, error: 'Missing name or email' });
        continue;
      }

      // Check if email already exists
      const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (existing.rows.length > 0) {
        errors.push({ row: i + 1, email, error: 'Email already exists' });
        continue;
      }

      // Generate 8-digit ID
      const seqRes = await client.query("SELECT nextval('student_id_seq')::text AS next_id");
      const studentId = seqRes.rows[0].next_id.padStart(8, '0');
      const rawPassword = customPassword || studentId;
      const hash = await bcrypt.hash(rawPassword, 12);

      const ins = await client.query(
        `INSERT INTO users (email, student_id, name, password_hash, role, password_changed)
         VALUES ($1, $2, $3, $4, 'student', false)
         RETURNING id, email, student_id, name`,
        [email, studentId, name, hash]
      );

      created.push({ ...ins.rows[0], initialPassword: rawPassword });
    }

    await client.query('COMMIT');

    res.json({
      successCount: created.length,
      errorCount: errors.length,
      created,
      errors,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/students/:id
 * Full student details, enrolled courses, and exam attempts
 */
router.get('/:id', async (req, res, next) => {
  try {
    const studentRes = await pool.query(
      `SELECT id, email, student_id, name, role, password_changed, last_active_at, created_at
       FROM users
       WHERE id = $1 AND role = 'student'`,
      [req.params.id]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentRes.rows[0];

    // Enrolled courses
    const coursesRes = await pool.query(
      `SELECT c.id, c.title, c.title_ar, en.created_at AS enrolled_at
       FROM courses c
       JOIN enrollments en ON c.id = en.course_id
       WHERE en.student_id = $1
       ORDER BY c.title ASC`,
      [student.id]
    );

    // Exam attempts & scores
    const attemptsRes = await pool.query(
      `SELECT a.id, a.exam_id, e.title AS exam_title, e.title_ar AS exam_title_ar,
              e.total_marks, (e.total_marks * 0.5) AS pass_mark,
              a.attempt_number, a.score, a.graded, a.started_at, a.submitted_at,
              CASE WHEN a.score >= (e.total_marks * 0.5) THEN true ELSE false END AS passed
       FROM exam_attempts a
       JOIN exams e ON a.exam_id = e.id
       WHERE a.student_id = $1
       ORDER BY a.started_at DESC`,
      [student.id]
    );

    res.json({
      student,
      courses: coursesRes.rows,
      examAttempts: attemptsRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/students/:id
 */
router.put('/:id', validate(updateStudentSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const updates = [];
    const params = [req.params.id];

    if (name) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }
    if (email) {
      params.push(email);
      updates.push(`email = $${params.length}`);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      params.push(hash);
      updates.push(`password_hash = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const query = `
      UPDATE users
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1 AND role = 'student'
      RETURNING id, email, student_id, name, updated_at
    `;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ student: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/students/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 AND role = 'student' RETURNING id", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
