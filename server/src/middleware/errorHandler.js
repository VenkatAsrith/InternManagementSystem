import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const isDev = env.NODE_ENV === 'development';

function send(res, req, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  if (req?.requestId) error.requestId = req.requestId;
  return res.status(status).json({ success: false, error });
}

export function notFoundHandler(req, res) {
  return send(res, req, 404, 'ROUTE_NOT_FOUND', 'The requested endpoint does not exist.');
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Deliberate application errors (AppError, TransitionError, ...)
  if (err && err.statusCode && err.code && err.statusCode < 500) {
    logger.debug(`${req.method} ${req.originalUrl} -> ${err.statusCode} ${err.code}`);
    return send(res, req, err.statusCode, err.code, err.message, err.details);
  }

  // Zod validation
  if (err?.name === 'ZodError') {
    return send(res, req, 422, 'VALIDATION_ERROR', 'Invalid request payload',
      err.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
  }

  // Mongoose schema validation -> 422 with a field list (never a 500)
  if (err?.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map(e => ({ field: e.path, message: e.kind === 'required' ? `${e.path} is required` : e.message }));
    return send(res, req, 422, 'VALIDATION_ERROR', 'Validation failed. Please correct the highlighted fields.', details);
  }

  // Bad ObjectId etc.
  if (err?.name === 'CastError') {
    return send(res, req, 400, 'INVALID_ID', `Invalid value supplied for '${err.path || 'identifier'}'.`);
  }

  // Duplicate key
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {}).filter(k => k !== 'organizationId');
    const field = fields[0] || 'value';
    return send(res, req, 409, 'DUPLICATE_KEY', `A record with this ${field} already exists.`);
  }

  // Upload errors (multer)
  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return send(res, req, 413, 'FILE_TOO_LARGE', `File is too large. Maximum size is ${Math.round(env.MAX_FILE_SIZE / 1048576)} MB.`);
    }
    return send(res, req, 400, 'UPLOAD_ERROR', 'The file upload could not be processed.');
  }

  // Body parser problems
  if (err?.type === 'entity.parse.failed') return send(res, req, 400, 'INVALID_JSON', 'Request body is not valid JSON.');
  if (err?.type === 'entity.too.large') return send(res, req, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');

  // JWT
  if (err?.name === 'TokenExpiredError') return send(res, req, 401, 'TOKEN_EXPIRED', 'Authentication token has expired');
  if (err?.name === 'JsonWebTokenError') return send(res, req, 401, 'INVALID_TOKEN', 'Invalid authentication token');

  // Everything else is a server fault. Log full detail, expose none of it.
  logger.error(`${req.method} ${req.originalUrl} - ${err?.stack || err}`);
  return send(res, req, 500, 'INTERNAL_SERVER_ERROR',
    isDev && err?.message ? `Unexpected error: ${err.message}` : 'An unexpected error occurred. Please try again or contact support.');
}
