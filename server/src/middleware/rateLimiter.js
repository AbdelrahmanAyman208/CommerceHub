const { redis } = require('../config/redis');
const { logger } = require('../utils/logger');

/**
 * Redis-based sliding window rate limiter
 * @param {number} maxRequests - Max number of requests allowed in window
 * @param {number} windowSeconds - Window size in seconds
 * @param {string} prefix - Key prefix (e.g. 'rl:login')
 */
function createRateLimiter(maxRequests = 60, windowSeconds = 60, prefix = 'rl:general') {
  return async (req, res, next) => {
    // Generate key based on IP or authenticated user ID
    const identifier = req.user ? `user:${req.user.id}` : (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    const key = `${prefix}:${identifier}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
        res.setHeader('Retry-After', ttl > 0 ? ttl : windowSeconds);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please try again in ${ttl > 0 ? ttl : windowSeconds} seconds.`,
        });
      }

      next();
    } catch (err) {
      // In case Redis has a glitch, log error and allow request through gracefully
      logger.warn({ err: err.message }, 'Rate limiter Redis error, failing open');
      next();
    }
  };
}

// Predefined limiters
const loginRateLimiter = createRateLimiter(5, 60, 'rl:login'); // 5 attempts per minute
const apiRateLimiter = createRateLimiter(120, 60, 'rl:api');   // 120 per minute

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  apiRateLimiter,
};
