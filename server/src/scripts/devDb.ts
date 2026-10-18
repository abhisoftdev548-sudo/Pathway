/**
 * Local development database.
 *
 * Production uses MongoDB Atlas (set MONGODB_URI). When a local MongoDB server is
 * not available, this script starts a MongoDB-wire-compatible embedded engine that
 * works with Mongoose for development and automated tests. Data persists under
 * server/.local-data (git-ignored).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NoSqlDbServer } from '@lossless.org/nosqldb';

const here = path.dirname(fileURLToPath(import.meta.url));
const storagePath = path.resolve(here, '../../.local-data/devdb');
const port = Number(process.env.DEV_DB_PORT ?? 27017);

async function main() {
  const server = new NoSqlDbServer({
    port,
    host: '127.0.0.1',
    storage: 'file',
    storagePath,
  });
  try {
    await server.start({ timeoutMs: 30_000 });
  } catch (error) {
    console.error(
      `[dev-db] Could not start on port ${port}. Stop the process using that port or set DEV_DB_PORT to another value.`,
    );
    throw error;
  }
  const connectionUri = server.getConnectionUri();
  console.log(`[dev-db] MongoDB-compatible development database ready at ${connectionUri}`);
  console.log(`[dev-db] Data directory: ${storagePath}`);
  console.log('[dev-db] For real MongoDB, install mongod or use MongoDB Atlas and set MONGODB_URI.');

  const shutdown = async () => {
    console.log('[dev-db] stopping...');
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('[dev-db] failed to start', error);
  process.exit(1);
});
