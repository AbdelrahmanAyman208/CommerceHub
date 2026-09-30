/**
 * Worker process — runs BullMQ workers and node-cron scheduled jobs.
 * Separate from the API process so job processing doesn't block HTTP requests.
 */
const { logger } = require('./utils/logger');
const { redis } = require('./config/redis');
const { pool } = require('./config/db');
const { initGradingWorker } = require('./workers/grading.worker');
const { initScheduler } = require('./workers/scheduler');

logger.info('CommerceHub Worker initializing...');

// Initialize BullMQ worker
const gradingWorker = initGradingWorker();

// Initialize node-cron schedulers
initScheduler();

logger.info('CommerceHub Worker ready and listening for jobs and schedules.');

const shutdown = async (signal) => {
  logger.info({ signal }, 'Worker shutting down...');
  try {
    await gradingWorker.close();
    await pool.end();
    redis.disconnect();
    logger.info('Worker cleanup complete.');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during worker shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
