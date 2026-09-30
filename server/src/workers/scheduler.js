const cron = require('node-cron');
const { pool } = require('../config/db');
const { logger } = require('../utils/logger');

/**
 * Send 24-hour and 1-hour reminders to enrolled students
 */
async function checkExamReminders() {
  try {
    // 1. Upcoming exams starting in 24h
    const upcoming24h = await pool.query(`
      SELECT e.id, e.title, e.title_ar, e.course_id, e.window_start
      FROM exams e
      WHERE e.published = true
        AND e.window_start BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
    `);

    for (const exam of upcoming24h.rows) {
      // Find enrolled students who don't have a reminder for this exam yet
      await pool.query(`
        INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
        SELECT en.student_id, 'exam_reminder',
          'Upcoming Exam: ' || $1,
          'امتحان قادم: ' || COALESCE(NULLIF($2, ''), $1),
          'The exam "' || $1 || '" will open on ' || to_char($3::timestamptz, 'YYYY-MM-DD HH24:MI'),
          'سيبدأ امتحان "' || COALESCE(NULLIF($2, ''), $1) || '" في ' || to_char($3::timestamptz, 'YYYY-MM-DD HH24:MI')
        FROM enrollments en
        WHERE en.course_id = $4
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.user_id = en.student_id
              AND n.type = 'exam_reminder'
              AND n.title LIKE '%' || $1 || '%'
              AND n.created_at > NOW() - INTERVAL '24 hours'
          )
      `, [exam.title, exam.title_ar, exam.window_start, exam.course_id]);
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Failed in exam reminders cron');
  }
}

/**
 * Check for students who missed exams after window_end closed
 */
async function checkMissedExams() {
  try {
    const closedExams = await pool.query(`
      SELECT e.id, e.title, e.title_ar, e.course_id, e.window_end
      FROM exams e
      WHERE e.published = true
        AND e.window_end BETWEEN NOW() - INTERVAL '2 hours' AND NOW()
    `);

    for (const exam of closedExams.rows) {
      await pool.query(`
        INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
        SELECT en.student_id, 'exam_missed',
          'Missed Exam: ' || $1,
          'فاتك امتحان: ' || COALESCE(NULLIF($2, ''), $1),
          'The submission window for "' || $1 || '" has closed and no submission was recorded.',
          'لقد انتهت فترة تسليم امتحان "' || COALESCE(NULLIF($2, ''), $1) || '" ولم تسجل أي محاولة.'
        FROM enrollments en
        WHERE en.course_id = $4
          AND NOT EXISTS (
            SELECT 1 FROM exam_attempts a
            WHERE a.student_id = en.student_id
              AND a.exam_id = $5
              AND a.submitted_at IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.user_id = en.student_id
              AND n.type = 'exam_missed'
              AND n.title LIKE '%' || $1 || '%'
          )
      `, [exam.title, exam.title_ar, exam.window_end, exam.course_id, exam.id]);
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Failed in missed exam cron');
  }
}

function initScheduler() {
  logger.info('Initializing node-cron schedulers...');
  // Every 30 minutes check exam reminders
  cron.schedule('*/30 * * * *', () => {
    logger.info('Running exam reminders cron');
    checkExamReminders();
  });

  // Every 15 minutes check closed exams
  cron.schedule('*/15 * * * *', () => {
    logger.info('Running missed exam check cron');
    checkMissedExams();
  });
}

module.exports = {
  initScheduler,
  checkExamReminders,
  checkMissedExams,
};
