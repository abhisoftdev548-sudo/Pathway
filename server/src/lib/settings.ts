import { all, get, run, nowIso, tx } from '../db/index.js';
import { unavailable } from './errors.js';

type Json = Record<string, any>;

const cache = new Map<string, { value: Json; at: number }>();
const TTL_MS = 5000;

export function getSetting<T = Json>(key: string, fallback: T): T {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const row = get<{ value: string }>('SELECT value FROM platform_settings WHERE key = ?', key);
  if (!row) return fallback;
  let parsed: Json;
  try {
    parsed = JSON.parse(row.value) as Json;
  } catch {
    return fallback;
  }
  const merged = { ...(fallback as unknown as Json), ...parsed } as unknown as T;
  cache.set(key, { value: merged as Json, at: Date.now() });
  return merged;
}

export function setSetting(key: string, value: Json, actorId?: string | null): void {
  tx(() => {
    run(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES (?,?,?,?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      key,
      JSON.stringify(value),
      actorId ?? null,
      nowIso(),
    );
  });
  cache.delete(key);
}

export function allSettings(): { key: string; value: Json; updated_at: string }[] {
  return all<{ key: string; value: string; updated_at: string }>(
    'SELECT key, value, updated_at FROM platform_settings ORDER BY key',
  ).map((r) => {
    try {
      return { key: r.key, value: JSON.parse(r.value), updated_at: r.updated_at };
    } catch {
      return { key: r.key, value: {}, updated_at: r.updated_at };
    }
  });
}

export function invalidateSettingsCache(): void {
  cache.clear();
}

export function requireFeature(name: string): void {
  const config = getSetting<Record<string, boolean>>('feature_config', {});
  if (config[name] === false) {
    throw unavailable('This feature is currently switched off.');
  }
}

export function isFeatureEnabled(name: string): boolean {
  const config = getSetting<Record<string, boolean>>('feature_config', {});
  return config[name] !== false;
}

export function maintenanceStatus(): { enabled: boolean; message: string } {
  return getSetting<{ enabled: boolean; message: string }>('maintenance', { enabled: false, message: '' });
}
