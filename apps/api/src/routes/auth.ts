import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { config, isProd } from '../config.js';
import { requireAuth, setAuthCookie, signToken } from '../middleware/auth.js';
import { badRequest, conflict, id, now, parse, unauthorized } from '../lib/utils.js';
import { selfUser } from '../lib/serializers.js';

const router = Router();
const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  bio: z.string().max(500).optional().default(''),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

router.post('/register', async (req, res, next) => {
  try {
    const body = parse(registerSchema, req.body);
    const store = req.store!;
    if (await store.users.findOne(u => u.email === body.email)) throw conflict('An account with this email already exists');
    const t = now();
    const user = await store.users.insert({
      id: id(), displayName: body.displayName, email: body.email,
      passwordHash: await bcrypt.hash(body.password, 10),
      role: 'user', bio: body.bio || '', avatar: '', isSuspended: false, createdAt: t, updatedAt: t,
    });
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: selfUser(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = parse(loginSchema, req.body);
    const user = await req.store!.users.findOne(u => u.email === body.email);
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw unauthorized('Invalid email or password');
    if (user.isSuspended) throw unauthorized('This account is suspended');
    setAuthCookie(res, signToken(user));
    res.json({ user: selfUser(user) });
  } catch (e) { next(e); }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(config.cookieName, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: selfUser(req.user!) }));

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req.body);
    const user = await req.store!.users.findOne(u => u.email === email);
    // Always 200 to avoid leaking which emails exist. In production the raw
    // token is emailed; with no mail provider configured we return it only outside production.
    let resetToken: string | undefined;
    if (user) {
      resetToken = randomBytes(32).toString('hex');
      await req.store!.users.update(user.id, {
        resetTokenHash: createHash('sha256').update(resetToken).digest('hex'),
        resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    }
    res.json({ message: 'If that email exists, a reset link has been sent.', ...(isProd ? {} : { resetToken }) });
  } catch (e) { next(e); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const body = parse(z.object({ token: z.string().min(10), password: z.string().min(8).max(128) }), req.body);
    const hash = createHash('sha256').update(body.token).digest('hex');
    const user = await req.store!.users.findOne(u => u.resetTokenHash === hash);
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < now()) throw badRequest('Reset link is invalid or has expired');
    await req.store!.users.update(user.id, {
      passwordHash: await bcrypt.hash(body.password, 10),
      resetTokenHash: undefined, resetTokenExpiresAt: undefined, updatedAt: now(),
    });
    res.json({ ok: true, message: 'Password updated. Please log in.' });
  } catch (e) { next(e); }
});

export default router;
