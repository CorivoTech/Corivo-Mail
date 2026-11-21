import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../../shared/validation.ts';
import { DEV_DEMO_PASSWORD } from '../db/seed.ts';
import { getDb, updateDb } from '../db/store.ts';
import {
  buildSessionPayload,
  checkLoginRateLimit,
  clearLoginRateLimit,
  recordSecurityEvent,
  resolveSessionContext,
  SESSION_COOKIE_NAME,
} from '../middleware/auth.ts';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  parseClientContext,
  verifyPassword,
} from '../security/password.ts';

export const authRouter = Router();

const DEFAULT_SESSION_MS = 12 * 60 * 60 * 1000;
const REMEMBER_SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_MS = 60 * 60 * 1000;

function runtimeMode(): 'PRODUCTION' | 'DEVELOPMENT_SIMULATED' {
  return process.env.CORIVO_RUNTIME_MODE === 'production' ? 'PRODUCTION' : 'DEVELOPMENT_SIMULATED';
}

/** Issue a persisted session, set the HTTP-only cookie and return the frontend payload. */
function issueSession(req: Request, res: Response, userId: string, rememberMe: boolean) {
  const rawToken = generateOpaqueToken(32);
  const now = new Date();
  const maxAge = rememberMe ? REMEMBER_SESSION_MS : DEFAULT_SESSION_MS;
  const { device, browser, ipAddress, location } = parseClientContext(req);

  updateDb((db) => {
    db.sessions.push({
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashToken(rawToken),
      device,
      browser,
      ipAddress,
      location,
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + maxAge).toISOString(),
      createdAt: now.toISOString(),
    });
    const user = db.users.find((u) => u.id === userId);
    if (user) user.lastLoginAt = now.toISOString();
  });

  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
    secure: false,
  });

  // Reuse the existing session resolver so the issued payload is identical to
  // what /api/auth/session returns on subsequent requests.
  req.cookies = { ...(req.cookies || {}), [SESSION_COOKIE_NAME]: rawToken };
  const ctx = resolveSessionContext(req);
  return ctx ? buildSessionPayload(ctx) : null;
}

authRouter.post('/api/auth/login', (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid sign-in details.' });
  }
  const { email, password, rememberMe } = parsed.data;
  const normalized = email.trim().toLowerCase();

  if (!checkLoginRateLimit(`login:${normalized}`)) {
    recordSecurityEvent(req, null, normalized, 'RATE_LIMIT_TRIGGERED', 'WARNING', 'Login rate limit reached.');
    return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
  }

  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === normalized);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordSecurityEvent(req, null, normalized, 'LOGIN_FAILED', 'WARNING', 'Invalid email or password.');
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.status === 'SUSPENDED') {
    recordSecurityEvent(req, null, normalized, 'ACCOUNT_SUSPENDED_ATTEMPT', 'WARNING', 'Suspended account attempted sign-in.');
    return res.status(403).json({ error: 'This account is suspended. Contact your administrator.' });
  }

  const membership = db.memberships.find(
    (m) => m.userId === user.id && m.status === 'ACTIVE'
  );
  if (membership) {
    const org = db.organisations.find((o) => o.id === membership.organisationId);
    if (org?.status === 'SUSPENDED' && !user.isPlatformAdmin) {
      return res.status(403).json({ error: 'This organisation is currently suspended.' });
    }
  }

  clearLoginRateLimit(`login:${normalized}`);
  const session = issueSession(req, res, user.id, rememberMe);
  if (!session) {
    return res.status(500).json({ error: 'Unable to establish a session. Please try again.' });
  }
  return res.json({ session, mode: runtimeMode() });
});

authRouter.get('/api/auth/session', (req: Request, res: Response) => {
  const ctx = resolveSessionContext(req);
  if (!ctx) {
    return res.json({ authenticated: false, session: null, mode: runtimeMode() });
  }
  return res.json({ authenticated: true, session: buildSessionPayload(ctx), mode: runtimeMode() });
});

authRouter.post('/api/auth/logout', (req: Request, res: Response) => {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof rawToken === 'string') {
    const tokenHash = hashToken(rawToken);
    const db = getDb();
    const session = db.sessions.find((s) => s.tokenHash === tokenHash);
    updateDb((d) => {
      d.sessions = d.sessions.filter((s) => s.tokenHash !== tokenHash);
    });
    if (session) {
      recordSecurityEvent(req, null, '', 'SESSION_REVOKED', 'INFO', 'User signed out.');
    }
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  return res.json({ ok: true, mode: runtimeMode() });
});

authRouter.get('/api/auth/demo-accounts', (_req: Request, res: Response) => {
  const db = getDb();
  const accounts = db.users.map((user) => {
    const membership =
      db.memberships.find((m) => m.userId === user.id && m.status === 'ACTIVE') ||
      db.memberships.find((m) => m.userId === user.id);
    const org = membership ? db.organisations.find((o) => o.id === membership.organisationId) : null;
    return {
      email: user.email,
      displayName: user.displayName,
      role: membership?.roleKey || (user.isPlatformAdmin ? 'PLATFORM_SUPER_ADMIN' : 'MAILBOX_USER'),
      organisationName: org?.name || 'Corivo Platform Ops',
      status: user.status,
      devPassword: DEV_DEMO_PASSWORD,
    };
  });
  return res.json({ accounts, mode: runtimeMode() });
});

authRouter.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Enter a valid email address.' });
  }
  const normalized = parsed.data.email.trim().toLowerCase();
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === normalized);

  // Always return the same envelope; only expose the dev token in development mode
  // so the local reset flow can be exercised without a real mail relay.
  const response: Record<string, unknown> = { ok: true, mode: runtimeMode() };
  if (user) {
    const rawToken = generateOpaqueToken(24);
    const now = new Date();
    updateDb((d) => {
      d.passwordResetTokens.push({
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(now.getTime() + RESET_TOKEN_MS).toISOString(),
        usedAt: null,
        createdAt: now.toISOString(),
      });
    });
    if (runtimeMode() === 'DEVELOPMENT_SIMULATED') {
      response.devResetToken = rawToken;
    }
  }
  return res.json(response);
});

authRouter.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reset request.' });
  }
  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);
  const db = getDb();
  const record = db.passwordResetTokens.find(
    (t) => t.tokenHash === tokenHash && !t.usedAt && new Date(t.expiresAt).getTime() > Date.now()
  );
  if (!record) {
    return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
  }
  const user = db.users.find((u) => u.id === record.userId);
  if (!user) {
    return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
  }

  const now = new Date().toISOString();
  updateDb((d) => {
    const target = d.users.find((u) => u.id === user.id);
    if (target) {
      target.passwordHash = hashPassword(password);
      target.passwordUpdatedAt = now;
      target.updatedAt = now;
    }
    const reset = d.passwordResetTokens.find((t) => t.id === record.id);
    if (reset) reset.usedAt = now;
    // A password reset invalidates all existing sessions for the user.
    d.sessions = d.sessions.filter((s) => s.userId !== user.id);
  });
  recordSecurityEvent(req, null, user.email, 'PASSWORD_CHANGED', 'INFO', 'Password reset completed.');

  return res.json({ ok: true, mode: runtimeMode() });
});

authRouter.post('/api/auth/register', (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration details.' });
  }
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const db = getDb();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const now = new Date().toISOString();
  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const domainId = crypto.randomUUID();
  const mailboxId = crypto.randomUUID();
  const domainName = email.split('@')[1] || 'example.com';
  const [firstName, ...rest] = data.fullName.trim().split(/\s+/);
  const lastName = rest.join(' ') || '-';
  const slugBase = data.organisationName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'organisation';

  updateDb((d) => {
    d.organisations.push({
      id: orgId,
      name: data.organisationName.trim(),
      legalName: data.organisationName.trim(),
      slug: `${slugBase}-${crypto.randomUUID().slice(0, 6)}`,
      logoUrl: null,
      businessCategory: 'Unspecified',
      country: data.country.trim(),
      size: '1-10 employees',
      primaryDomain: domainName,
      website: '',
      contactEmail: email,
      contactPhone: '',
      address: '',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      storageQuotaMb: 10240,
      onboardingComplete: false,
      createdAt: now,
      updatedAt: now,
    });
    d.users.push({
      id: userId,
      email,
      passwordHash: hashPassword(data.password),
      firstName,
      lastName,
      displayName: data.fullName.trim(),
      jobTitle: 'Owner',
      department: 'Executive',
      phone: '',
      avatarUrl: null,
      status: 'ACTIVE',
      isPlatformAdmin: false,
      lastLoginAt: null,
      passwordUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    d.memberships.push({
      id: crypto.randomUUID(),
      organisationId: orgId,
      userId,
      roleKey: 'OWNER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    d.domains.push({
      id: domainId,
      organisationId: orgId,
      domainName,
      isPrimary: true,
      ownershipStatus: 'PENDING',
      verificationToken: `corivo-verify=${generateOpaqueToken(12)}`,
      mxStatus: 'PENDING',
      spfStatus: 'PENDING',
      dkimStatus: 'PENDING',
      dmarcStatus: 'PENDING',
      tlsStatus: 'UNKNOWN',
      dkimSelector: 'corivo1',
      dkimPublicKey: '',
      dkimKeyRef: `kms://corivo-dev/dkim/${domainName}`,
      lastCheckedAt: null,
      verificationMode: 'DEVELOPMENT_SIMULATED',
      createdAt: now,
      updatedAt: now,
    });
    d.mailboxes.push({
      id: mailboxId,
      organisationId: orgId,
      domainId,
      userId,
      username: email.split('@')[0],
      emailAddress: email,
      displayName: data.fullName.trim(),
      roleKey: 'OWNER',
      status: 'ACTIVE',
      quotaMb: 10240,
      usedMb: 0,
      lastActivityAt: null,
      createdAt: now,
      updatedAt: now,
    });
    for (const slug of ['inbox', 'sent', 'drafts', 'archive', 'spam', 'trash', 'snoozed']) {
      d.folders.push({
        id: crypto.randomUUID(),
        mailboxId,
        name: slug.charAt(0).toUpperCase() + slug.slice(1),
        slug,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    d.userPreferences.push({
      id: crypto.randomUUID(),
      userId,
      language: 'en-IN',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      theme: 'light',
      density: 'comfortable',
      defaultReplyMode: 'reply',
      threadingEnabled: true,
      readingPane: 'right',
      defaultFont: 'DM Sans',
      confirmBeforeSend: false,
      signatureHtml: '',
      signatureEnabled: true,
      newEmailAlerts: true,
      browserNotifications: false,
      securityAlerts: true,
      productAnnouncements: false,
      updatedAt: now,
    });
    d.organisationSettings.push({
      id: crypto.randomUUID(),
      organisationId: orgId,
      defaultLanguage: 'en-IN',
      defaultTimezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      defaultQuotaMb: 10240,
      defaultRoleKey: 'MAILBOX_USER',
      minPasswordLength: 10,
      requireComplexity: true,
      sessionTimeoutHours: 12,
      maxLoginAttempts: 8,
      enforce2fa: false,
      notifyDomainAlerts: true,
      notifyQuotaWarnings: true,
      notifySecurity: true,
      notifyDelivery: true,
      updatedAt: now,
    });
  });

  const session = issueSession(req, res, userId, false);
  if (!session) {
    return res.status(500).json({ error: 'Account created but the session could not be established.' });
  }
  return res.status(201).json({ session, mode: runtimeMode() });
});

export default authRouter;
