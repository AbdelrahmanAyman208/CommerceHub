const { Pool } = require('pg');
const { env } = require('./env');
const { logger } = require('../utils/logger');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === 'production' ? 20 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle database client');
});

pool.on('connect', () => {
  logger.debug('New database client connected');
});

/** Parameterized query wrapper */
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
