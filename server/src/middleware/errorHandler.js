const { logger } = require('../utils/logger');

/**
 * Central error handler — catches all unhandled errors from routes.
 * Express requires all 4 args to identify this as an error middleware.
 */
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? 'Internal server error' : err.message;

  if (status >= 500) {
    logger.error({ err, method: req.method, url: req.url }, 'Server error');
  } else {
    logger.warn({ status, message, method: req.method, url: req.url }, 'Client error');
  }

  res.status(status).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

module.exports = { errorHandler };
