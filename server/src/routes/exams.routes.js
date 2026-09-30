const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireAdmin, requireStudent } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createExamSchema,
  updateExamSchema,
  createQuestionSchema,
  updateQuestionSchema,
  autosaveSchema,
} = require('../schemas/exam.schema');
const { shuffleArray } = require('../utils/shuffle');
const { gradingQueue, gradeAttempt } = require('../workers/grading.worker');
const { logger } = require('../utils/logger');

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════
// EXAM LIST & DETAILS
// ══════════════════════════════════════════════════════════════════════

/**
 * GET /api/exams
 * List exams based on role
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      // Student: list exams for enrolled courses
      const result = await pool.query(
        `SELECT e.id, e.course_id, c.title AS course_title, c.title_ar AS course_title_ar,
                e.title, e.title_ar, e.window_start, e.window_end, e.duration_minutes,
                e.total_marks, ROUND(e.total_marks * 0.5, 2) AS pass_mark,
                e.max_attempts, e.score_policy,
                COUNT(a.id)::int AS my_attempts_count,
                MAX(a.score) AS my_best_score,
                EXISTS (
                  SELECT 1 FROM exam_attempts ea
                  WHERE ea.exam_id = e.id AND ea.student_id = $1 AND ea.submitted_at IS NULL AND ea.expires_at > NOW()
                ) AS has_active_attempt,
                CASE
                  WHEN NOW() < e.window_start THEN 'upcoming'
                  WHEN NOW() > e.window_end THEN 'closed'
                  ELSE 'active'
                END AS window_status
         FROM exams e
         JOIN courses c ON e.course_id = c.id
         JOIN enrollments en ON c.id = en.course_id AND en.student_id = $1
         LEFT JOIN exam_attempts a ON e.id = a.exam_id AND a.student_id = $1 AND a.submitted_at IS NOT NULL
         WHERE e.published = true
         GROUP BY e.id, c.title, c.title_ar
         ORDER BY e.window_start ASC`,
        [req.user.id]
      );
      return res.json({ exams: result.rows });
    }

    // Admin: list all exams with question counts and attempts stats
    const courseId = req.query.courseId;
    let query = `
      SELECT e.id, e.course_id, c.title AS course_title, c.title_ar AS course_title_ar,
             e.title, e.title_ar, e.window_start, e.window_end, e.duration_minutes,
             e.total_marks, ROUND(e.total_marks * 0.5, 2) AS pass_mark,
             e.max_attempts, e.score_policy, e.randomize_questions, e.randomize_options,
             e.published, e.created_at,
             COUNT(DISTINCT q.id)::int AS question_count,
             COUNT(DISTINCT a.id)::int AS total_attempts_count
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN questions q ON e.id = q.exam_id
      LEFT JOIN exam_attempts a ON e.id = a.exam_id
    `;
    const params = [];

    if (courseId) {
      params.push(courseId);
      query += ` WHERE e.course_id = $1`;
    }

    query += ` GROUP BY e.id, c.title, c.title_ar ORDER BY e.created_at DESC`;
    const result = await pool.query(query, params);
    res.json({ exams: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/exams/:id
 * Get single exam details and questions (questions only for admin or active student)
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const examRes = await pool.query(
      `SELECT e.*, ROUND(e.total_marks * 0.5, 2) AS pass_mark,
              c.title AS course_title, c.title_ar AS course_title_ar
       FROM exams e
       JOIN courses c ON e.course_id = c.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (examRes.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const exam = examRes.rows[0];

    // If admin, include all questions WITH correct_key
    if (req.user.role !== 'student') {
      const questionsRes = await pool.query(
        'SELECT * FROM questions WHERE exam_id = $1 ORDER BY sort_order ASC, created_at ASC',
        [exam.id]
      );
      return res.json({ exam, questions: questionsRes.rows });
    }

    // Student only gets exam metadata
    res.json({ exam });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════
// ADMIN EXAM MANAGEMENT (Doctor and Assistant)
// ══════════════════════════════════════════════════════════════════════

/**
 * POST /api/exams
 * Create exam
 */
router.post('/', authenticate, requireAdmin, validate(createExamSchema), async (req, res, next) => {
  try {
    const {
      course_id,
      title,
      title_ar,
      window_start,
      window_end,
      duration_minutes,
      total_marks,
      max_attempts,
      score_policy,
      randomize_questions,
      randomize_options,
      published,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO exams (
        course_id, title, title_ar, window_start, window_end,
        duration_minutes, total_marks, max_attempts, score_policy,
        randomize_questions, randomize_options, published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *, ROUND(total_marks * 0.5, 2) AS pass_mark`,
      [
        course_id,
        title,
        title_ar || '',
        window_start,
        window_end,
        duration_minutes,
        total_marks,
        max_attempts || 1,
        score_policy || 'best',
        randomize_questions || false,
        randomize_options || false,
        published || false,
      ]
    );

    res.status(201).json({ exam: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/exams/:id
 */
router.put('/:id', authenticate, requireAdmin, validate(updateExamSchema), async (req, res, next) => {
  try {
    const fields = [
      'course_id', 'title', 'title_ar', 'window_start', 'window_end',
      'duration_minutes', 'total_marks', 'max_attempts', 'score_policy',
      'randomize_questions', 'randomize_options', 'published'
    ];

    const updates = [];
    const params = [req.params.id];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const query = `
      UPDATE exams
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *, ROUND(total_marks * 0.5, 2) AS pass_mark
    `;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    res.json({ exam: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/exams/:id/publish
 * Toggle publish status
 */
router.put('/:id/publish', authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const examRes = await client.query('SELECT * FROM exams WHERE id = $1', [req.params.id]);
    if (examRes.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const exam = examRes.rows[0];
    const newStatus = !exam.published;

    await client.query('BEGIN');

    await client.query('UPDATE exams SET published = $1, updated_at = NOW() WHERE id = $2', [newStatus, exam.id]);

    // If publishing, send notification to enrolled students
    if (newStatus) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
         SELECT en.student_id, 'exam_published',
           'Exam Available: ' || $1,
           'امتحان جديد متاح: ' || $2,
           'The exam "' || $1 || '" has been published. Check your schedule!',
           'تم نشر امتحان "' || $2 || '". يرجى التحقق من المواعيد!'
         FROM enrollments en
         WHERE en.course_id = $3`,
        [exam.title, exam.title_ar || exam.title, exam.course_id]
      );
    }

    await client.query('COMMIT');
    res.json({ id: exam.id, published: newStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/exams/:id
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM exams WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════
// QUESTION MANAGEMENT (Admin)
// ══════════════════════════════════════════════════════════════════════

/**
 * POST /api/exams/:id/questions
 * Add question
 */
router.post('/:id/questions', authenticate, requireAdmin, validate(createQuestionSchema), async (req, res, next) => {
  try {
    const { type, text, text_ar, options, correct_key, points, sort_order } = req.body;
    const examId = req.params.id;

    const result = await pool.query(
      `INSERT INTO questions (exam_id, type, text, text_ar, options, correct_key, points, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [examId, type, text, text_ar || '', JSON.stringify(options), correct_key, points, sort_order || 0]
    );

    res.status(201).json({ question: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/exams/:id/questions/:qid
 */
router.put('/:id/questions/:qid', authenticate, requireAdmin, validate(updateQuestionSchema), async (req, res, next) => {
  try {
    const fields = ['type', 'text', 'text_ar', 'options', 'correct_key', 'points', 'sort_order'];
    const updates = [];
    const params = [req.params.qid, req.params.id];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        const val = f === 'options' ? JSON.stringify(req.body[f]) : req.body[f];
        params.push(val);
        updates.push(`${f} = $${params.length}`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `
      UPDATE questions
      SET ${updates.join(', ')}
      WHERE id = $1 AND exam_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ question: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/exams/:id/questions/:qid
 */
router.delete('/:id/questions/:qid', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM questions WHERE id = $1 AND exam_id = $2 RETURNING id',
      [req.params.qid, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════
// STUDENT EXAM TAKING FLOW
// ══════════════════════════════════════════════════════════════════════

/**
 * POST /api/exams/:id/start
 * Start exam attempt
 */
router.post('/:id/start', authenticate, requireStudent, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const examId = req.params.id;
    const studentId = req.user.id;

    await client.query('BEGIN');

    // 1. Check exam existence and publication
    const examRes = await client.query(
      `SELECT e.*, (e.total_marks * 0.5) AS pass_mark
       FROM exams e
       WHERE e.id = $1`,
      [examId]
    );

    if (examRes.rows.length === 0 || !examRes.rows[0].published) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Exam not found or not published' });
    }

    const exam = examRes.rows[0];

    // 2. Check window
    const now = new Date();
    if (now < new Date(exam.window_start)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Exam window has not started yet' });
    }
    if (now > new Date(exam.window_end)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Exam window has ended' });
    }

    // 3. Check enrollment
    const enRes = await client.query(
      'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [studentId, exam.course_id]
    );
    if (enRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // 4. Check existing active attempt
    const activeRes = await client.query(
      `SELECT * FROM exam_attempts
       WHERE student_id = $1 AND exam_id = $2 AND submitted_at IS NULL AND expires_at > NOW()`,
      [studentId, examId]
    );

    if (activeRes.rows.length > 0) {
      await client.query('COMMIT');
      // Resume existing active attempt
      const attempt = activeRes.rows[0];
      return res.json({
        message: 'Resuming active attempt',
        attemptId: attempt.id,
        attemptNumber: attempt.attempt_number,
        expiresAt: attempt.expires_at,
      });
    }

    // 5. Check attempts limit
    const attemptsCountRes = await client.query(
      'SELECT COUNT(*)::int AS count FROM exam_attempts WHERE student_id = $1 AND exam_id = $2',
      [studentId, examId]
    );
    const existingCount = attemptsCountRes.rows[0].count;

    if (existingCount >= exam.max_attempts) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Maximum attempts reached (${existingCount}/${exam.max_attempts})`,
      });
    }

    const nextAttemptNumber = existingCount + 1;

    // 6. Calculate server-side expiry: LEAST(now + duration, window_end)
    const durationMs = exam.duration_minutes * 60 * 1000;
    const calculatedExpiry = new Date(Date.now() + durationMs);
    const windowEnd = new Date(exam.window_end);
    const expiresAt = calculatedExpiry < windowEnd ? calculatedExpiry : windowEnd;

    // 7. Fetch questions and randomize if configured
    const questionsRes = await client.query(
      'SELECT id, type, text, text_ar, options, points, sort_order FROM questions WHERE exam_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [examId]
    );

    if (questionsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This exam has no questions yet' });
    }

    let questions = questionsRes.rows;
    if (exam.randomize_questions) {
      questions = shuffleArray(questions);
    }

    // Process questions: NEVER SEND correct_key!
    const sanitizedQuestions = questions.map((q) => {
      let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
      if (exam.randomize_options) {
        opts = shuffleArray(opts);
      }
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        text_ar: q.text_ar,
        points: q.points,
        options: opts.map((o) => ({ key: o.key, text: o.text, text_ar: o.text_ar })),
      };
    });

    const questionOrderSnapshot = sanitizedQuestions.map((q) => ({
      id: q.id,
      optionsOrder: q.options.map((o) => o.key),
    }));

    // 8. Insert attempt
    const attemptInsert = await client.query(
      `INSERT INTO exam_attempts (student_id, exam_id, attempt_number, expires_at, question_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, student_id, exam_id, attempt_number, started_at, expires_at`,
      [studentId, examId, nextAttemptNumber, expiresAt.toISOString(), JSON.stringify(questionOrderSnapshot)]
    );

    await client.query('COMMIT');

    res.status(201).json({
      attempt: attemptInsert.rows[0],
      exam: {
        id: exam.id,
        title: exam.title,
        title_ar: exam.title_ar,
        durationMinutes: exam.duration_minutes,
        totalMarks: exam.total_marks,
        passMark: exam.pass_mark,
        maxAttempts: exam.max_attempts,
      },
      questions: sanitizedQuestions,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * GET /api/exams/:id/resume
 * Resume active exam attempt
 */
router.get('/:id/resume', authenticate, requireStudent, async (req, res, next) => {
  try {
    const examId = req.params.id;
    const studentId = req.user.id;

    // Find active unsubmitted attempt
    const attemptRes = await pool.query(
      `SELECT a.*, e.title, e.title_ar, e.duration_minutes, e.total_marks,
              (e.total_marks * 0.5) AS pass_mark
       FROM exam_attempts a
       JOIN exams e ON a.exam_id = e.id
       WHERE a.exam_id = $1 AND a.student_id = $2 AND a.submitted_at IS NULL AND a.expires_at > NOW()`,
      [examId, studentId]
    );

    if (attemptRes.rows.length === 0) {
      return res.status(404).json({ error: 'No active attempt found' });
    }

    const attempt = attemptRes.rows[0];

    // Fetch existing saved answers
    const answersRes = await pool.query(
      'SELECT question_id, selected_key FROM answers WHERE attempt_id = $1',
      [attempt.id]
    );

    const savedAnswers = {};
    for (const ans of answersRes.rows) {
      savedAnswers[ans.question_id] = ans.selected_key;
    }

    // Reconstruct questions in stored question_order snapshot
    const questionOrder = typeof attempt.question_order === 'string'
      ? JSON.parse(attempt.question_order)
      : attempt.question_order || [];

    const questionsRes = await pool.query(
      'SELECT id, type, text, text_ar, options, points FROM questions WHERE exam_id = $1',
      [examId]
    );

    const qMap = new Map();
    for (const q of questionsRes.rows) {
      qMap.set(q.id, q);
    }

    const orderedQuestions = [];
    for (const item of questionOrder) {
      const q = qMap.get(item.id);
      if (q) {
        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        const optMap = new Map();
        opts.forEach((o) => optMap.set(o.key, o));
        const sortedOpts = (item.optionsOrder || []).map((k) => optMap.get(k)).filter(Boolean);

        orderedQuestions.push({
          id: q.id,
          type: q.type,
          text: q.text,
          text_ar: q.text_ar,
          points: q.points,
          options: sortedOpts.map((o) => ({ key: o.key, text: o.text, text_ar: o.text_ar })),
        });
      }
    }

    res.json({
      attempt: {
        id: attempt.id,
        attemptNumber: attempt.attempt_number,
        startedAt: attempt.started_at,
        expiresAt: attempt.expires_at,
      },
      exam: {
        id: attempt.exam_id,
        title: attempt.title,
        title_ar: attempt.title_ar,
        totalMarks: attempt.total_marks,
        passMark: attempt.pass_mark,
      },
      questions: orderedQuestions,
      savedAnswers,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/exams/:id/autosave
 * Autosave answers (debounced batch upsert, server-enforced expiration)
 */
router.put('/:id/autosave', authenticate, requireStudent, validate(autosaveSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const examId = req.params.id;
    const studentId = req.user.id;
    const { answers } = req.body;

    // Check active attempt with 5s grace window
    const attemptRes = await client.query(
      `SELECT id, expires_at, submitted_at
       FROM exam_attempts
       WHERE exam_id = $1 AND student_id = $2 AND submitted_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [examId, studentId]
    );

    if (attemptRes.rows.length === 0) {
      return res.status(400).json({ error: 'No active attempt found' });
    }

    const attempt = attemptRes.rows[0];
    const expiryWithGrace = new Date(new Date(attempt.expires_at).getTime() + 5000);
    if (new Date() > expiryWithGrace) {
      return res.status(400).json({ error: 'Exam attempt has expired' });
    }

    await client.query('BEGIN');

    for (const ans of answers) {
      if (ans.question_id) {
        await client.query(
          `INSERT INTO answers (attempt_id, question_id, selected_key, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (attempt_id, question_id)
           DO UPDATE SET selected_key = EXCLUDED.selected_key, updated_at = NOW()`,
          [attempt.id, ans.question_id, ans.selected_key || null]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ status: 'saved', timestamp: new Date().toISOString() });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/exams/:id/submit
 * Submit exam attempt (idempotent, server-side timer enforcement)
 */
router.post('/:id/submit', authenticate, requireStudent, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const examId = req.params.id;
    const studentId = req.user.id;

    await client.query('BEGIN');

    const attemptRes = await client.query(
      `SELECT id, expires_at, submitted_at, graded, score
       FROM exam_attempts
       WHERE exam_id = $1 AND student_id = $2
       ORDER BY started_at DESC LIMIT 1
       FOR UPDATE`,
      [examId, studentId]
    );

    if (attemptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No exam attempt found to submit' });
    }

    const attempt = attemptRes.rows[0];

    // Idempotent: already submitted
    if (attempt.submitted_at) {
      await client.query('COMMIT');
      return res.json({
        message: 'Exam already submitted',
        attemptId: attempt.id,
        graded: attempt.graded,
        score: attempt.score,
      });
    }

    // 5-second grace window check
    const expiryWithGrace = new Date(new Date(attempt.expires_at).getTime() + 5000);
    if (new Date() > expiryWithGrace) {
      logger.warn({ attemptId: attempt.id }, 'Submission arrived after expiration grace window');
    }

    await client.query(
      'UPDATE exam_attempts SET submitted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [attempt.id]
    );

    await client.query('COMMIT');

    // Trigger BullMQ job + immediate grading fallback
    try {
      await gradingQueue.add('grade-attempt', { attemptId: attempt.id });
    } catch (qErr) {
      logger.warn({ err: qErr.message }, 'BullMQ enqueue failed, executing direct grading fallback');
    }

    // Direct synchronous grade to ensure instantaneous feedback
    const gradeResult = await gradeAttempt(attempt.id).catch((err) => {
      logger.error({ err: err.message }, 'Immediate grading fallback failed');
      return null;
    });

    res.status(202).json({
      message: 'Exam submitted successfully',
      attemptId: attempt.id,
      gradeResult: gradeResult || { status: 'grading_in_progress' },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
