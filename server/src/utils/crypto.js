import crypto from 'node:crypto';

/** URL-safe slug from arbitrary text. */
export function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/** Append a short random suffix to guarantee unique slugs. */
export function uniqueSlug(base) {
  return `${slugify(base)}-${crypto.randomBytes(3).toString('hex')}`;
}

/** SHA-256 hex digest used to store refresh/reset tokens at rest. */
export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** Constant-time string comparison for token-like values. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Opaque random token (used for refresh tokens and password resets). */
export function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Human-friendly, unique transaction id. */
export function transactionId() {
  return `tx_${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`;
}
