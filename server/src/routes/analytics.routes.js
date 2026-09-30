const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * GET /api/admin/analytics/overview
 */
router.get('/overview', async (req, res, next) => {
  try {
    const [studentsRes, coursesRes, examsRes, attemptsRes, pdfViewsRes] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'student'"),
      pool.query('SELECT COUNT(*)::int AS count FROM courses'),
      pool.query('SELECT COUNT(*)::int AS count FROM exams'),
      pool.query(`
        SELECT COUNT(*)::int AS total_attempts,
               COUNT(*) FILTER (WHERE a.score >= (e.total_marks * 0.5))::int AS passed_attempts,
               ROUND(AVG(a.score), 2) AS average_score
        FROM exam_attempts a
        JOIN exams e ON a.exam_id = e.id
        WHERE a.graded = true
      `),
      pool.query("SELECT COUNT(*)::int AS count FROM lecture_logs WHERE action = 'view'"),
    ]);

    const totalStudents = studentsRes.rows[0].count;
    const totalCourses = coursesRes.rows[0].count;
    const totalExams = examsRes.rows[0].count;
    const { total_attempts, passed_attempts, average_score } = attemptsRes.rows[0];
    const passRate = total_attempts > 0 ? Math.round((passed_attempts / total_attempts) * 100) : 0;
    const totalPdfViews = pdfViewsRes.rows[0].count;

    res.json({
      overview: {
        totalStudents,
        totalCourses,
        totalExams,
        totalAttempts: total_attempts || 0,
        passRate,
        averageScore: average_score || 0,
        totalPdfViews,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/grade-distribution
 */
router.get('/grade-distribution', async (req, res, next) => {
  try {
    const examId = req.query.examId;
    let query = `
      SELECT
        CASE
          WHEN (a.score / NULLIF(e.total_marks, 0)) * 100 < 50 THEN '0-49% (Fail)'
          WHEN (a.score / NULLIF(e.total_marks, 0)) * 100 < 65 THEN '50-64% (Pass)'
          WHEN (a.score / NULLIF(e.total_marks, 0)) * 100 < 75 THEN '65-74% (Good)'
          WHEN (a.score / NULLIF(e.total_marks, 0)) * 100 < 85 THEN '75-84% (Very Good)'
          ELSE '85-100% (Excellent)'
        END AS bucket,
        COUNT(*)::int AS student_count
      FROM exam_attempts a
      JOIN exams e ON a.exam_id = e.id
      WHERE a.graded = true
    `;
    const params = [];

    if (examId) {
      params.push(examId);
      query += ` AND a.exam_id = $1`;
    }

    query += ` GROUP BY 1 ORDER BY 1 ASC`;

    const result = await pool.query(query, params);
    res.json({ distribution: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/pass-fail
 */
router.get('/pass-fail', async (req, res, next) => {
  try {
    const examId = req.query.examId;
    let query = `
      SELECT
        COUNT(*) FILTER (WHERE a.score >= (e.total_marks * 0.5))::int AS passed,
        COUNT(*) FILTER (WHERE a.score < (e.total_marks * 0.5))::int AS failed
      FROM exam_attempts a
      JOIN exams e ON a.exam_id = e.id
      WHERE a.graded = true
    `;
    const params = [];

    if (examId) {
      params.push(examId);
      query += ` AND a.exam_id = $1`;
    }

    const result = await pool.query(query, params);
    res.json({
      passFail: [
        { name: 'Passed (>=50%)', name_ar: 'ناجح (>=50%)', count: result.rows[0].passed || 0, color: '#10b981' },
        { name: 'Failed (<50%)', name_ar: 'راسب (<50%)', count: result.rows[0].failed || 0, color: '#ef4444' },
      ],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/pdf-engagement
 */
router.get('/pdf-engagement', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.title AS course_title, c.title_ar AS course_title_ar,
             l.title AS lecture_title, l.title_ar AS lecture_title_ar,
             COUNT(ll.id)::int AS view_count,
             COUNT(DISTINCT ll.student_id)::int AS unique_students_viewed
      FROM lectures l
      JOIN courses c ON l.course_id = c.id
      LEFT JOIN lecture_logs ll ON l.id = ll.lecture_id AND ll.action = 'view'
      GROUP BY c.id, c.title, c.title_ar, l.id, l.title, l.title_ar, l.sort_order
      ORDER BY view_count DESC
      LIMIT 10
    `);

    res.json({ engagement: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/at-risk
 * Students with low performance (< 50% avg score) or low activity
 */
router.get('/at-risk', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.student_id, u.name, u.email, u.last_active_at,
             COUNT(a.id)::int AS attempts_count,
             ROUND(AVG(a.score), 2) AS average_score,
             COUNT(a.id) FILTER (WHERE a.score < (e.total_marks * 0.5))::int AS failed_exams_count
      FROM users u
      JOIN exam_attempts a ON u.id = a.student_id AND a.graded = true
      JOIN exams e ON a.exam_id = e.id
      WHERE u.role = 'student'
      GROUP BY u.id
      HAVING AVG(a.score / NULLIF(e.total_marks, 0)) < 0.50 OR COUNT(a.id) FILTER (WHERE a.score < (e.total_marks * 0.5)) >= 1
      ORDER BY average_score ASC
      LIMIT 20
    `);

    res.json({ atRiskStudents: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
