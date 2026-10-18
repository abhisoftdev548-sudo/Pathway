import { createStore } from './store.js';
import { seedIfEmpty } from './seed.js';
const store = createStore();
await store.ready();
await seedIfEmpty(store);
// give the file store a moment to flush
await new Promise(r => setTimeout(r, 200));
console.log('[seed] done');
process.exit(0);
