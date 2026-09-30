const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { env } = require('../config/env');
const { validate } = require('../middleware/validate');
const { loginSchema, changePasswordSchema } = require('../schemas/auth.schema');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Supports login via email or 8-digit student_id
 */
router.post('/login', loginRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    // Search by email OR student_id
    const userRes = await pool.query(
      `SELECT id, email, student_id, name, password_hash, role, password_changed
       FROM users
       WHERE LOWER(email) = LOWER($1) OR student_id = $1`,
      [identifier.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userRes.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, studentId: user.student_id },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Update last_active_at
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        studentId: user.student_id,
        name: user.name,
        role: user.role,
        passwordChanged: user.password_changed,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const userRes = await pool.query(
      'SELECT id, email, student_id, name, role, password_changed FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role, studentId: user.student_id },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    res.json({
      accessToken: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        studentId: user.student_id,
        name: user.name,
        role: user.role,
        passwordChanged: user.password_changed,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      studentId: req.user.student_id,
      name: req.user.name,
      role: req.user.role,
      passwordChanged: req.user.password_changed,
    },
  });
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { newPassword, currentPassword } = req.body;

    // If student has changed password before, verify current password
    if (req.user.password_changed && currentPassword) {
      const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
      if (!valid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed = true, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
