import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { badRequest } from '../utils/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and *replaces* the request section with the parsed value.
 * Unknown keys are stripped by Zod object schemas, which mitigates mass-assignment.
 */
export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(validationError(result.error));
    }
    // Express 4 query/params are getters; assign through a plain object.
    if (source === 'query') {
      Object.defineProperty(req, 'validatedQuery', { value: result.data, writable: true, configurable: true });
      req.query = result.data as Request['query'];
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}

export function validationError(error: ZodError) {
  return badRequest(
    'Some fields are invalid. Please review the highlighted values.',
    error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}

export function requireValidObjectIdParam(param = 'id') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[param];
    if (!value || !/^[a-f\d]{24}$/i.test(value)) return next(badRequest(`Invalid ${param}`));
    next();
  };
}
