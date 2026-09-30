const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createAdminSchema } = require('../schemas/student.schema');

const router = express.Router();

// Only super_admin (the doctor) can manage admins
router.use(authenticate, requireSuperAdmin);

/**
 * GET /api/admin/admins
 * List all admins and assistants
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role, last_active_at, created_at
       FROM users
       WHERE role IN ('admin', 'super_admin')
       ORDER BY role DESC, created_at ASC`
    );
    res.json({ admins: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/admins
 * Create a new assistant (or super_admin)
 */
router.post('/', validate(createAdminSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 12);
    const insertRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, password_changed)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, email, role, created_at`,
      [name, email, hash, role || 'admin']
    );

    res.status(201).json({ admin: insertRes.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/admins/:id
 * Delete assistant (cannot delete self or the main doctor)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    const targetRes = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (targetRes.rows[0].role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete another super admin account' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'Admin deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
