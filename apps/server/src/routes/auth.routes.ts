import { Router } from 'express';
import { z } from 'zod';
import { CATEGORY_SLUGS } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { handler } from '../lib/async.js';
import { badRequest, conflict, notConfigured, unauthorized } from '../lib/errors.js';
import { hashIp } from '../lib/crypto.js';
import { stringifyJson } from '../lib/json.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { attachAuth, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  assertNotSuspended,
  assertUsernameAvailable,
  assertPasswordStrength,
  clearSessionCookie,
  createSession,
  hashPassword,
  revokeSession,
  setSessionCookie,
  suggestUsername,
  toSessionUser,
  verifyPassword,
} from '../services/auth.service.js';
import { recordAudit } from '../services/audit.service.js';
import { exchangeGoogleCode, googleAuthUrl, googleConfigured } from '../services/google.service.js';

export const authRouter = Router();

const agreementsSchema = z.object({
  christianContent: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the Christian Content Policy to join FaithTube.' }),
  }),
  guidelines: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the Community Guidelines.' }),
  }),
  privacy: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Privacy Policy.' }),
  }),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  displayName: z.string().min(2).max(60),
  username: z.string().min(3).max(30),
  country: z.string().length(2).optional(),
  dateOfBirth: z.string().date().optional(),
  agreements: agreementsSchema,
});

authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  handler(async (req, res) => {
    const body = req.body as z.infer<typeof registerSchema>;
    assertPasswordStrength(body.password);

    const email = body.email.toLowerCase().trim();
    if (await prisma.user.findUnique({ where: { email } })) {
      throw conflict('An account already exists for that email address.');
    }
    const username = await assertUsernameAvailable(body.username);

    const now = new Date();
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName.trim(),
        username,
        country: body.country?.toUpperCase(),
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        acceptedChristianContentAt: now,
        acceptedGuidelinesAt: now,
        acceptedPrivacyAt: now,
        notificationPrefs: stringifyJson({}),
      },
      include: { channel: true, premium: true },
    });

    const session = await createSession(user.id, 'VIEWER', {
      userAgent: req.headers['user-agent'],
      ipHash: hashIp(req.ip, env.JWT_SECRET),
    });
    setSessionCookie(res, session.token, session.expiresAt);
    await recordAudit({ actorId: user.id, action: 'auth.register', targetType: 'USER', targetId: user.id, summary: 'Account created', req });

    res.status(201).json({ user: toSessionUser(user), token: session.token });
  }),
);

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  handler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { channel: true, premium: true },
    });

    // Same response for unknown account and wrong password, so the endpoint
    // cannot be used to enumerate registered email addresses.
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized('That email and password combination is not correct.');
    }
    if (user.deletedAt) throw unauthorized('That account has been closed.');
    assertNotSuspended(user);

    const session = await createSession(user.id, user.role as never, {
      userAgent: req.headers['user-agent'],
      ipHash: hashIp(req.ip, env.JWT_SECRET),
    });
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ user: toSessionUser(user), token: session.token });
  }),
);

authRouter.post(
  '/logout',
  attachAuth,
  handler(async (req, res) => {
    if (req.auth) await revokeSession(req.auth.sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/session',
  attachAuth,
  handler(async (req, res) => {
    if (!req.auth) return res.json({ user: null });
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { channel: true, premium: true },
    });
    res.json({ user: user ? toSessionUser(user) : null });
  }),
);

// ------------------------------------------------------------- Google OAuth

authRouter.get(
  '/google/url',
  handler(async (req, res) => {
    if (!googleConfigured()) {
      throw notConfigured(
        'Continue with Google',
        'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI, then restart the API. ' +
          'Until then, email sign-in works normally.',
      );
    }
    const state = String(req.query.state ?? '');
    res.json({ url: googleAuthUrl(state) });
  }),
);

const googleCallbackSchema = z.object({ code: z.string().min(10), state: z.string().optional() });

authRouter.post(
  '/google/callback',
  authLimiter,
  validateBody(googleCallbackSchema),
  handler(async (req, res) => {
    const { code } = req.body as z.infer<typeof googleCallbackSchema>;
    const profile = await exchangeGoogleCode(code);

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
      include: { channel: true, premium: true },
    });

    let created = false;
    if (!user) {
      // A Google sign-up still has to accept the platform agreements, which the
      // client collects during onboarding; the account starts un-onboarded.
      user = await prisma.user.create({
        data: {
          email: profile.email,
          emailVerified: profile.emailVerified,
          googleId: profile.sub,
          displayName: profile.name || profile.email.split('@')[0],
          username: await suggestUsername(profile.email.split('@')[0]),
          avatarUrl: profile.picture,
          notificationPrefs: stringifyJson({}),
        },
        include: { channel: true, premium: true },
      });
      created = true;
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.sub, emailVerified: user.emailVerified || profile.emailVerified },
        include: { channel: true, premium: true },
      });
    }

    if (user.deletedAt) throw unauthorized('That account has been closed.');
    assertNotSuspended(user);

    const session = await createSession(user.id, user.role as never, {
      userAgent: req.headers['user-agent'],
      ipHash: hashIp(req.ip, env.JWT_SECRET),
    });
    setSessionCookie(res, session.token, session.expiresAt);
    await recordAudit({
      actorId: user.id,
      action: created ? 'auth.register.google' : 'auth.login.google',
      targetType: 'USER',
      targetId: user.id,
      summary: created ? 'Account created via Google' : 'Signed in with Google',
      req,
    });

    res.json({ user: toSessionUser(user), token: session.token, created, needsOnboarding: !user.onboardingComplete });
  }),
);

// -------------------------------------------------------------- onboarding

const onboardingSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  displayName: z.string().min(2).max(60).optional(),
  country: z.string().length(2).optional(),
  interests: z.array(z.enum(CATEGORY_SLUGS as [string, ...string[]])).min(1).max(20),
  agreements: agreementsSchema,
});

authRouter.post(
  '/onboarding',
  requireAuth,
  validateBody(onboardingSchema),
  handler(async (req, res) => {
    const body = req.body as z.infer<typeof onboardingSchema>;
    const username = body.username ? await assertUsernameAvailable(body.username, req.auth!.userId) : undefined;
    const now = new Date();

    const user = await prisma.user.update({
      where: { id: req.auth!.userId },
      data: {
        username,
        displayName: body.displayName?.trim(),
        country: body.country?.toUpperCase(),
        interests: stringifyJson(body.interests),
        onboardingComplete: true,
        acceptedChristianContentAt: now,
        acceptedGuidelinesAt: now,
        acceptedPrivacyAt: now,
      },
      include: { channel: true, premium: true },
    });
    res.json({ user: toSessionUser(user) });
  }),
);

const usernameCheckSchema = z.object({ username: z.string().min(1).max(40) });

authRouter.post(
  '/check-username',
  validateBody(usernameCheckSchema),
  handler(async (req, res) => {
    const { username } = req.body as z.infer<typeof usernameCheckSchema>;
    try {
      const normalized = await assertUsernameAvailable(username);
      res.json({ available: true, username: normalized });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That username is not available.';
      res.json({ available: false, message, suggestion: await suggestUsername(username) });
    }
  }),
);

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});

authRouter.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validateBody(passwordChangeSchema),
  handler(async (req, res) => {
    const body = req.body as z.infer<typeof passwordChangeSchema>;
    assertPasswordStrength(body.newPassword);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
    if (!user.passwordHash) {
      throw badRequest('This account signs in with Google and has no password to change.');
    }
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw unauthorized('Your current password is not correct.');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });
    // Other devices are signed out; the current session stays valid.
    await prisma.session.updateMany({
      where: { userId: user.id, id: { not: req.auth!.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit({ action: 'auth.password.change', targetType: 'USER', targetId: user.id, summary: 'Password changed', req });
    res.json({ ok: true });
  }),
);
