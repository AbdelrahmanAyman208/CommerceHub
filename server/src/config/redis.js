const Redis = require('ioredis');
const { env } = require('./env');
const { logger } = require('../utils/logger');

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: false,
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

module.exports = { redis };
