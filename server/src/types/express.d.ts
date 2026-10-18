import 'express-serve-static-core';
import type { Role } from '../models/constants.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role: Role;
      name: string;
      email: string;
      tokenVersion: number;
    };
    requestId?: string;
    validatedQuery?: unknown;
  }
}
