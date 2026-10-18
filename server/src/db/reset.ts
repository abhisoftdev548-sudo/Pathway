import fs from 'node:fs';
import { closeDb, resolveDbPath } from './index.js';
import { migrate } from './migrate.js';

/**
 * Deletes the database file and recreates an empty schema, so the application
 * starts from a genuinely empty state. Use this to verify that no sample data
 * ships with the product.
 */
function main() {
  const file = resolveDbPath();
  if (file === ':memory:') {
    console.log('In-memory database: nothing to delete.');
    return;
  }
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    const target = `${file}${suffix}`;
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      console.log(`Removed ${target}`);
    }
  }
  migrate();
  console.log('Empty schema recreated. Every list in the app will now show its empty state.');
}

main();
