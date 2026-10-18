/** Typed application errors that map predictably onto HTTP responses. */
export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'The request was not understood.', details?: unknown) =>
  new AppError(400, 'bad_request', message, details);

export const validationError = (message = 'Please correct the highlighted fields.', details?: unknown) =>
  new AppError(422, 'validation_error', message, details);

export const unauthorized = (message = 'You need to sign in to continue.') =>
  new AppError(401, 'unauthorized', message);

export const forbidden = (message = 'You do not have access to this.') =>
  new AppError(403, 'forbidden', message);

export const notFound = (message = 'That could not be found.') => new AppError(404, 'not_found', message);

export const conflict = (message = 'That conflicts with an existing record.', details?: unknown) =>
  new AppError(409, 'conflict', message, details);

export const gone = (message = 'This is no longer available.') => new AppError(410, 'gone', message);

export const tooMany = (message = 'Too many requests. Please slow down.') =>
  new AppError(429, 'too_many_requests', message);

export const unavailable = (message = 'This feature is not available right now.') =>
  new AppError(503, 'unavailable', message);
