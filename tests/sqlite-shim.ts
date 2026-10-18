/**
 * Vite 5's built-in module list predates `node:sqlite`, so it tries to resolve
 * the specifier as a package. This shim loads the real built-in through
 * `createRequire`, which handles the `node:` prefix natively.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sqlite = require('node:sqlite') as typeof import('node:sqlite');

export const DatabaseSync = sqlite.DatabaseSync;
