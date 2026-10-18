import { config } from './config.js';
import { createStore } from './db/store.js';
import { seedIfEmpty } from './db/seed.js';
import { createApp } from './app.js';

const store = createStore();
await store.ready();
if (config.seedOnBoot) await seedIfEmpty(store);
const app = createApp(store);
app.listen(config.port, '0.0.0.0', () => {
  console.log(`[api] QuizSphere API listening on http://0.0.0.0:${config.port} (store: ${store.kind})`);
});
