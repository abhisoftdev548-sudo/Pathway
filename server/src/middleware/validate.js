import { ApiError } from '../utils/ApiError.js';

/**
 * Zod request validation middleware.
 * Strips unknown keys (`.strict()` schemas reject them) and replaces
 * req.body/req.query/req.params with the typed, sanitized values.
 */
export const validate =
  ({ body: bodySchema, query: querySchema, params: paramsSchema }) =>
  (req, _res, next) => {
    try {
      if (bodySchema) {
        const result = bodySchema.safeParse(req.body ?? {});
        if (!result.success) {
          return next(
            ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', formatIssues(result.error))
          );
        }
        req.body = result.data;
      }
      if (querySchema) {
        const result = querySchema.safeParse(req.query ?? {});
        if (!result.success) {
          return next(
            ApiError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', formatIssues(result.error))
          );
        }
        // Keep original query (Express 5 compat) but expose parsed values.
        req.validatedQuery = result.data;
      }
      if (paramsSchema) {
        const result = paramsSchema.safeParse(req.params ?? {});
        if (!result.success) {
          return next(
            ApiError.badRequest('Invalid route parameters', 'VALIDATION_ERROR', formatIssues(result.error))
          );
        }
        req.params = result.data;
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };

function formatIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
