const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendNotificationSchema } = require('../schemas/notification.schema');

const router = express.Router();

/**
 * GET /api/notifications
 * Fetch user's notifications (includes broadcasts where user_id IS NULL)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, type, title, title_ar, body, body_ar, read, created_at
       FROM notifications
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const unreadCountRes = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE (user_id = $1 OR user_id IS NULL) AND read = false`,
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      unreadCount: unreadCountRes.rows[0].count,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all user notifications as read
 */
router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 OR user_id IS NULL',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications
 * Send notification (both Doctor and Assistant can send announcements!)
 */
router.post('/', authenticate, requireAdmin, validate(sendNotificationSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { user_id, course_id, title, title_ar, body, body_ar, type } = req.body;

    await client.query('BEGIN');

    if (course_id) {
      // Send to all students enrolled in course
      const ins = await client.query(
        `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
         SELECT en.student_id, $1, $2, $3, $4, $5
         FROM enrollments en
         WHERE en.course_id = $6
         RETURNING id`,
        [type || 'manual', title, title_ar || title, body, body_ar || body, course_id]
      );
      await client.query('COMMIT');
      return res.status(201).json({ message: `Sent to ${ins.rowCount} students enrolled in course` });
    }

    if (user_id) {
      // Send to specific user
      const ins = await client.query(
        `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [user_id, type || 'manual', title, title_ar || title, body, body_ar || body]
      );
      await client.query('COMMIT');
      return res.status(201).json({ notification: ins.rows[0] });
    }

    // Broadcast to ALL users
    const ins = await client.query(
      `INSERT INTO notifications (user_id, type, title, title_ar, body, body_ar)
       VALUES (NULL, $1, $2, $3, $4, $5)
       RETURNING *`,
      [type || 'manual', title, title_ar || title, body, body_ar || body]
    );

    await client.query('COMMIT');
    res.status(201).json({ notification: ins.rows[0], broadcast: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
