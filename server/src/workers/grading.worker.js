const { Worker, Queue } = require('bullmq');
const { pool } = require('../config/db');
const { redis } = require('../config/redis');
const { logger } = require('../utils/logger');

const GRADING_QUEUE_NAME = 'exam-grading';

// Queue instance to enqueue jobs
const gradingQueue = new Queue(GRADING_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  },
});

/**
 * Core grading logic - can be called synchronously or from BullMQ worker
 */
async function gradeAttempt(attemptId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch attempt and exam metadata
    const attemptRes = await client.query(
      `SELECT a.id, a.student_id, a.exam_id, a.graded,
              e.title, e.title_ar, e.total_marks
       FROM exam_attempts a
       JOIN exams e ON a.exam_id = e.id
       WHERE a.id = $1 FOR UPDATE`,
      [attemptId]
    );

    if (attemptRes.rows.length === 0) {
      throw new Error(`Attempt ${attemptId} not found`);
    }

    const attempt = attemptRes.rows[0];
    if (attempt.graded) {
      await client.query('COMMIT');
      return { score: attempt.score, graded: true };
    }

    // 2. Fetch questions with points and correct keys
    const questionsRes = await client.query(
      'SELECT id, correct_key, points FROM questions WHERE exam_id = $1',
      [attempt.exam_id]
    );

    // 3. Fetch student's submitted answers
    const answersRes = await client.query(
      'SELECT question_id, selected_key FROM answers WHERE attempt_id = $1',
      [attemptId]
    );

    const answerMap = new Map();
    for (const ans of answersRes.rows) {
      answerMap.set(ans.question_id, ans.selected_key);
    }

    // 4. Calculate total score
    let totalEarned = 0;
    for (const q of questionsRes.rows) {
      const selected = answerMap.get(q.id);
      if (selected && selected === q.correct_key) {
        totalEarned += parseFloat(q.points);
      }
    }

    const finalScore = Math.round(totalEarned * 100) / 100;
    const totalMarks = parseFloat(attempt.total_marks);
    const passMark = totalMarks * 0.5; // Always 50%
    const passed = finalScore >= passMark;

    // 5. Update attempt
    await client.query(
      'UPDATE exam_attempts SET score = $1, graded = true, updated_at = NOW() WHERE id = $2',
      [finalScore, attemptId]
    );

    // 6. Create notification for student
    const title = `Result for ${attempt.title}: ${finalScore} / ${totalMarks} (${passed ? 'Passed' : 'Failed'})`;
    const title_ar = `نتيجة ${attempt.title_ar || attempt.title}: ${finalScore} / ${totalMarks} (${passed ? 'ناجح' : 'راسب'})`;
    const body = `You scored ${finalScore} out of ${totalMarks}. Minimum pass mark is ${passMark} (50%).`;
    const body_ar = `حصلت على ${finalScore} من ${totalMarks}. درجة النجاح المطلوبة هي ${passMark} (50%).`;

    await client.query(
      `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
       VALUES ($1, 'result_available', $2, $3, $4, $5)`,
      [attempt.student_id, title, title_ar, body, body_ar]
    );

    await client.query('COMMIT');
    logger.info({ attemptId, studentId: attempt.student_id, score: finalScore, passed }, 'Exam attempt graded successfully');

    return { score: finalScore, passed, totalMarks, passMark };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err: err.message, attemptId }, 'Failed to grade attempt');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Initialize BullMQ Worker
 */
function initGradingWorker() {
  const worker = new Worker(
    GRADING_QUEUE_NAME,
    async (job) => {
      logger.info({ jobId: job.id, attemptId: job.data.attemptId }, 'Processing grading job');
      return await gradeAttempt(job.data.attemptId);
    },
    { connection: redis }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Grading job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Grading job failed');
  });

  return worker;
}

module.exports = {
  gradingQueue,
  gradeAttempt,
  initGradingWorker,
};
