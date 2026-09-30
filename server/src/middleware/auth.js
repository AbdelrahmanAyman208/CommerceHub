const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { pool } = require('../config/db');

/**
 * Authenticate JWT Access Token
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // Attach user data from payload or DB
    const result = await pool.query(
      'SELECT id, email, student_id, name, role, password_changed FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    req.user = result.rows[0];

    // Asynchronously record last_active_at (lightweight fire-and-forget)
    pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.user.id]).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-based authorization guard
 * Example: requireRole('super_admin', 'admin')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to perform this action.',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
}

/**
 * Super Admin only guard (the doctor)
 * Assistants ('admin') are rejected here!
 */
const requireSuperAdmin = requireRole('super_admin');

/**
 * Any admin guard (doctor or assistant)
 */
const requireAdmin = requireRole('super_admin', 'admin');

/**
 * Student only guard
 */
const requireStudent = requireRole('student');

module.exports = {
  authenticate,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  requireStudent,
};
