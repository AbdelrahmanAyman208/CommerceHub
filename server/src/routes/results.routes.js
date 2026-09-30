const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireAdmin, requireSuperAdmin, requireStudent } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { overrideScoreSchema } = require('../schemas/exam.schema');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

const router = express.Router();

/**
 * GET /api/results/my
 * Student results for all taken exams
 */
router.get('/my', authenticate, requireStudent, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id AS attempt_id, a.attempt_number, a.score, a.graded,
              a.started_at, a.submitted_at,
              e.id AS exam_id, e.title, e.title_ar, e.total_marks,
              ROUND(e.total_marks * 0.5, 2) AS pass_mark,
              CASE WHEN a.score >= (e.total_marks * 0.5) THEN true ELSE false END AS passed,
              c.id AS course_id, c.title AS course_title, c.title_ar AS course_title_ar
       FROM exam_attempts a
       JOIN exams e ON a.exam_id = e.id
       JOIN courses c ON e.course_id = c.id
       WHERE a.student_id = $1 AND a.submitted_at IS NOT NULL
       ORDER BY a.submitted_at DESC`,
      [req.user.id]
    );

    res.json({ results: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/results
 * Admin view of all attempts with filters (both super_admin and assistant can view)
 */
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const { examId, courseId, search } = req.query;

    let baseQuery = `
      FROM exam_attempts a
      JOIN users u ON a.student_id = u.id
      JOIN exams e ON a.exam_id = e.id
      JOIN courses c ON e.course_id = c.id
      WHERE a.submitted_at IS NOT NULL
    `;
    const params = [];

    if (examId) {
      params.push(examId);
      baseQuery += ` AND a.exam_id = $${params.length}`;
    }
    if (courseId) {
      params.push(courseId);
      baseQuery += ` AND e.course_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      baseQuery += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR u.student_id LIKE $${params.length})`;
    }

    const countRes = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);

    const dataQuery = `
      SELECT a.id AS attempt_id, a.attempt_number, a.score, a.graded,
             a.started_at, a.submitted_at,
             u.id AS student_id, u.student_id AS student_number, u.name AS student_name, u.email AS student_email,
             e.id AS exam_id, e.title AS exam_title, e.title_ar AS exam_title_ar, e.total_marks,
             ROUND(e.total_marks * 0.5, 2) AS pass_mark,
             CASE WHEN a.score >= (e.total_marks * 0.5) THEN true ELSE false END AS passed,
             c.id AS course_id, c.title AS course_title, c.title_ar AS course_title_ar
      ${baseQuery}
      ORDER BY a.submitted_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const dataRes = await pool.query(dataQuery, params);

    res.json(formatPaginatedResponse(dataRes.rows, countRes.rows[0].count, page, limit));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/results/:attemptId
 * Detailed view of single attempt with questions and student answers
 */
router.get('/:attemptId', authenticate, async (req, res, next) => {
  try {
    const attemptRes = await pool.query(
      `SELECT a.*, u.name AS student_name, u.student_id AS student_number,
              e.title AS exam_title, e.title_ar AS exam_title_ar, e.total_marks,
              ROUND(e.total_marks * 0.5, 2) AS pass_mark,
              CASE WHEN a.score >= (e.total_marks * 0.5) THEN true ELSE false END AS passed
       FROM exam_attempts a
       JOIN users u ON a.student_id = u.id
       JOIN exams e ON a.exam_id = e.id
       WHERE a.id = $1`,
      [req.params.attemptId]
    );

    if (attemptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptRes.rows[0];

    // If student, can only view own attempt
    if (req.user.role === 'student' && attempt.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch questions and answers
    const qAndAns = await pool.query(
      `SELECT q.id AS question_id, q.type, q.text, q.text_ar, q.options,
              q.points, q.correct_key,
              ans.selected_key,
              CASE WHEN ans.selected_key = q.correct_key THEN true ELSE false END AS is_correct
       FROM questions q
       LEFT JOIN answers ans ON ans.question_id = q.id AND ans.attempt_id = $1
       WHERE q.exam_id = $2
       ORDER BY q.sort_order ASC, q.created_at ASC`,
      [attempt.id, attempt.exam_id]
    );

    // If student, strip correct_key if needed or show review if graded
    const questions = qAndAns.rows.map((row) => ({
      ...row,
      options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
      correct_key: req.user.role === 'student' && !attempt.graded ? undefined : row.correct_key,
    }));

    res.json({ attempt, questions });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/results/:attemptId/score
 * 🔒 SUPER ADMIN ONLY (The Doctor)
 * Assistant admins receive 403 Forbidden!
 */
router.put('/:attemptId/score', authenticate, requireSuperAdmin, validate(overrideScoreSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { score } = req.body;
    const { attemptId } = req.params;

    await client.query('BEGIN');

    const attemptRes = await client.query(
      `SELECT a.id, a.student_id, a.score AS old_score, e.title, e.title_ar, e.total_marks
       FROM exam_attempts a
       JOIN exams e ON a.exam_id = e.id
       WHERE a.id = $1 FOR UPDATE`,
      [attemptId]
    );

    if (attemptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptRes.rows[0];
    const totalMarks = parseFloat(attempt.total_marks);
    const newScore = parseFloat(score);

    if (newScore > totalMarks) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Score (${newScore}) cannot exceed total exam marks (${totalMarks})`,
      });
    }

    const passMark = totalMarks * 0.5;
    const passed = newScore >= passMark;

    // Update score
    await client.query(
      'UPDATE exam_attempts SET score = $1, graded = true, updated_at = NOW() WHERE id = $2',
      [newScore, attemptId]
    );

    // Notify student about grade adjustment
    const title = `Grade adjusted for ${attempt.title}: ${newScore} / ${totalMarks}`;
    const title_ar = `تعديل درجة ${attempt.title_ar || attempt.title}: ${newScore} / ${totalMarks}`;
    const body = `Your grade was adjusted by Dr. ${req.user.name}. New score: ${newScore} / ${totalMarks} (${passed ? 'Passed' : 'Failed'}).`;
    const body_ar = `تم تعديل درجتك بواسطة د. ${req.user.name}. الدرجة الجديدة: ${newScore} / ${totalMarks} (${passed ? 'ناجح' : 'راسب'}).`;

    await client.query(
      `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
       VALUES ($1, 'result_available', $2, $3, $4, $5)`,
      [attempt.student_id, title, title_ar, body, body_ar]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Score adjusted successfully by Super Admin (Doctor)',
      attemptId,
      oldScore: attempt.old_score,
      newScore,
      totalMarks,
      passed,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
