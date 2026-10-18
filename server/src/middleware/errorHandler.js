import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/responses.js';

/** 404 for unmatched API routes. */
export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

/**
 * Centralized error handling — one consistent error envelope for every failure.
 * Unexpected errors are logged; their messages never leak stack traces to clients
 * in production.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status ?? 500;
  let code = err.code ?? 'INTERNAL';
  let message = err.message ?? 'Internal server error';
  let details = err.details;

  // Mongoose duplicate key
  if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    const fields = Object.keys(err.keyPattern ?? {});
    message = fields.length ? `Duplicate value for: ${fields.join(', ')}` : 'Duplicate value';
    details = undefined;
  }

  // Mongoose validation / cast errors
  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors ?? {}).map((e) => ({ path: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = `Invalid value for ${err.path}`;
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON body';
  }

  if (status >= 500 && !err.isOperational) {
    // eslint-disable-next-line no-console
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    if (!config.isProduction) {
      // Keep the original message in development for faster debugging.
      message = err.message ?? message;
    } else {
      message = 'Internal server error';
      code = 'INTERNAL';
      details = undefined;
    }
  }

  return sendError(res, status, code, message, details);
}
