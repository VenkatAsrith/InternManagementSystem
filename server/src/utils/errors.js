// Structured application errors. The central error handler turns these into the standard
// { success:false, error:{ code, message, details? } } envelope. Never put internals in `message`.
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, code = 'BAD_REQUEST', details = null) => new AppError(message, 400, code, details);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') => new AppError(message, 401, code);
export const forbidden = (message = 'You do not have permission to perform this action.', code = 'FORBIDDEN') => new AppError(message, 403, code);
export const notFound = (message = 'Resource not found', code = 'NOT_FOUND') => new AppError(message, 404, code);
export const conflict = (message, code = 'CONFLICT', details = null) => new AppError(message, 409, code, details);
export const gone = (message, code = 'GONE') => new AppError(message, 410, code);
export const unprocessable = (message, details = null, code = 'VALIDATION_ERROR') => new AppError(message, 422, code, details);
