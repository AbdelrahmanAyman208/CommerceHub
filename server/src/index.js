const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { env } = require('./config/env');
const { pool } = require('./config/db');
const { redis } = require('./config/redis');
const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/auth.routes');
const studentsRoutes = require('./routes/students.routes');
const adminsRoutes = require('./routes/admins.routes');
const coursesRoutes = require('./routes/courses.routes');
const lecturesRoutes = require('./routes/lectures.routes');
const examsRoutes = require('./routes/exams.routes');
const resultsRoutes = require('./routes/results.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();

// ── Security & Parsing ──────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible PDF embedded frame viewing
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Request logging ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

// ── Health Check ────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const [dbResult, redisResult] = await Promise.all([
      pool.query('SELECT 1'),
      redis.ping(),
    ]);
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbResult.rows.length > 0 ? 'up' : 'down',
        redis: redisResult === 'PONG' ? 'up' : 'down',
      },
    });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
});

// ── API Routes ──────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin/students', studentsRoutes);
app.use('/api/admin/admins', adminsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/lectures', lecturesRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin/analytics', analyticsRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'CommerceHub API v1.0.0',
    status: 'online',
    endpoints: [
      '/api/auth',
      '/api/admin/students',
      '/api/admin/admins',
      '/api/courses',
      '/api/lectures',
      '/api/exams',
      '/api/results',
      '/api/notifications',
      '/api/admin/analytics',
    ],
  });
});

// ── Error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

// ── Start server ────────────────────────────────────────────────────
const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'CommerceHub API started');
});

// ── Graceful shutdown ───────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info({ signal }, 'Shutting down gracefully...');
  server.close(async () => {
    await pool.end();
    redis.disconnect();
    logger.info('Cleanup complete, exiting.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app };
