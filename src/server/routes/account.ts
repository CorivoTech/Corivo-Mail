import crypto from 'node:crypto';
import { Router } from 'express';
import {
  changePasswordSchema,
  isValidIanaTimezone,
  organisationSetupSchema,
  profileUpdateSchema,
  sanitizeHtml,
} from '../../shared/validation.ts';
import { getDb, updateDb } from '../db/store.ts';
import {
  type AuthedRequest,
  recordAudit,
  recordSecurityEvent,
  requireAuth,
  sanitizeUser,
} from '../middleware/auth.ts';
import { hashPassword, verifyPassword } from '../security/password.ts';

export const accountRouter = Router();

const ALLOWED_FONTS = ['DM Sans', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'Georgia'];
const ALLOWED_TIME_FORMATS = ['12h', '24h'];
const ALLOWED_DENSITIES = ['comfortable', 'compact'];
const ALLOWED_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const ALLOWED_REPLY_MODES = ['reply', 'reply_all'];
const ALLOWED_READING_PANES = ['right', 'bottom', 'off'];

function currentUser(req: AuthedRequest) {
  return req.auth!.user;
}

function findOrCreatePreferences(userId: string) {
  const db = getDb();
  let prefs = db.userPreferences.find((p) => p.userId === userId);
  if (!prefs) {
    const now = new Date().toISOString();
    prefs = {
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
    };
    updateDb((d) => {
      d.userPreferences.push(prefs!);
    });
  }
  return prefs;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

accountRouter.get('/api/users/me', requireAuth, (req: AuthedRequest, res) => {
  const user = currentUser(req);
  return res.json({ user: sanitizeUser(user) });
});

accountRouter.patch('/api/users/me', requireAuth, (req: AuthedRequest, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile details.' });
  }
  const userId = currentUser(req).id;
  const data = parsed.data;
  updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return;
    user.firstName = data.firstName;
    user.lastName = data.lastName;
    user.displayName = data.displayName;
    user.jobTitle = data.jobTitle ?? '';
    user.department = data.department ?? '';
    user.phone = data.phone || '';
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    user.updatedAt = new Date().toISOString();
    const mailbox = db.mailboxes.find((m) => m.userId === userId);
    if (mailbox) {
      mailbox.displayName = data.displayName;
      mailbox.updatedAt = user.updatedAt;
    }
  });
  const updated = getDb().users.find((u) => u.id === userId);
  if (!updated) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: sanitizeUser(updated) });
});

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

accountRouter.get('/api/users/me/preferences', requireAuth, (req: AuthedRequest, res) => {
  return res.json({ preferences: findOrCreatePreferences(currentUser(req).id) });
});

accountRouter.patch('/api/users/me/preferences', requireAuth, (req: AuthedRequest, res) => {
  const body = (req.body || {}) as Record<string, unknown>;

  if (typeof body.timezone === 'string' && !isValidIanaTimezone(body.timezone)) {
    return res.status(400).json({ error: 'Invalid timezone.' });
  }
  if (typeof body.defaultFont === 'string' && !ALLOWED_FONTS.includes(body.defaultFont)) {
    return res.status(400).json({ error: 'Invalid default font.' });
  }
  if (typeof body.timeFormat === 'string' && !ALLOWED_TIME_FORMATS.includes(body.timeFormat)) {
    return res.status(400).json({ error: 'Invalid time format.' });
  }
  if (typeof body.dateFormat === 'string' && !ALLOWED_DATE_FORMATS.includes(body.dateFormat)) {
    return res.status(400).json({ error: 'Invalid date format.' });
  }
  if (typeof body.density === 'string' && !ALLOWED_DENSITIES.includes(body.density)) {
    return res.status(400).json({ error: 'Invalid density.' });
  }
  if (typeof body.defaultReplyMode === 'string' && !ALLOWED_REPLY_MODES.includes(body.defaultReplyMode)) {
    return res.status(400).json({ error: 'Invalid reply mode.' });
  }
  if (typeof body.readingPane === 'string' && !ALLOWED_READING_PANES.includes(body.readingPane)) {
    return res.status(400).json({ error: 'Invalid reading pane setting.' });
  }

  const userId = currentUser(req).id;
  findOrCreatePreferences(userId);
  updateDb((db) => {
    const prefs = db.userPreferences.find((p) => p.userId === userId);
    if (!prefs) return;
    const fields = [
      'language', 'timezone', 'dateFormat', 'timeFormat', 'theme', 'density',
      'defaultReplyMode', 'threadingEnabled', 'readingPane', 'defaultFont',
      'confirmBeforeSend', 'signatureEnabled', 'newEmailAlerts',
      'browserNotifications', 'securityAlerts', 'productAnnouncements',
    ] as const;
    for (const field of fields) {
      if (body[field] !== undefined) {
        (prefs as unknown as Record<string, unknown>)[field] = body[field];
      }
    }
    if (typeof body.signatureHtml === 'string') {
      prefs.signatureHtml = sanitizeHtml(body.signatureHtml);
    }
    prefs.updatedAt = new Date().toISOString();
  });
  return res.json({ preferences: findOrCreatePreferences(userId) });
});

// ---------------------------------------------------------------------------
// Sessions & password
// ---------------------------------------------------------------------------

accountRouter.get('/api/users/me/sessions', requireAuth, (req: AuthedRequest, res) => {
  const user = currentUser(req);
  const db = getDb();
  const ctx = req.auth!;
  const sessions = db.sessions
    .filter((s) => s.userId === user.id)
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))
    .map((s) => ({
      id: s.id,
      device: s.device,
      browser: s.browser,
      ipAddress: s.ipAddress,
      location: s.location,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === ctx.sessionId,
    }));
  const orgSettings = ctx.organisation
    ? db.organisationSettings.find((o) => o.organisationId === ctx.organisation!.id)
    : null;
  return res.json({
    sessions,
    passwordPolicy: { minPasswordLength: orgSettings?.minPasswordLength ?? 10, requireComplexity: orgSettings?.requireComplexity ?? true },
    recentEvents: db.securityEvents.filter((e) => e.actorEmail === user.email).slice(0, 12),
  });
});

accountRouter.delete('/api/users/me/sessions/others', requireAuth, (req: AuthedRequest, res) => {
  const user = currentUser(req);
  const ctx = req.auth!;
  const removed = updateDb((db) => {
    const before = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.userId !== user.id || s.id === ctx.sessionId);
    return before - db.sessions.length;
  });
  recordSecurityEvent(req, ctx.organisation?.id || null, user.email, 'SESSION_REVOKED', 'INFO', `Revoked ${removed} other session(s).`);
  return res.json({ ok: true, revoked: removed });
});

accountRouter.delete('/api/users/me/sessions/:id', requireAuth, (req: AuthedRequest, res) => {
  const user = currentUser(req);
  const ctx = req.auth!;
  const id = req.params.id;
  const session = getDb().sessions.find((s) => s.id === id && s.userId === user.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  if (session.id === ctx.sessionId) {
    return res.status(400).json({ error: 'Use sign out to end the current session.' });
  }
  updateDb((db) => {
    db.sessions = db.sessions.filter((s) => s.id !== id);
  });
  recordSecurityEvent(req, ctx.organisation?.id || null, user.email, 'SESSION_REVOKED', 'INFO', 'A secondary session was revoked.');
  return res.json({ ok: true });
});

accountRouter.patch('/api/users/me/password', requireAuth, (req: AuthedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password request.' });
  }
  const { currentPassword, newPassword, invalidateOtherSessions } = parsed.data;
  const user = currentUser(req);
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  const ctx = req.auth!;
  const now = new Date().toISOString();
  updateDb((db) => {
    const target = db.users.find((u) => u.id === user.id);
    if (target) {
      target.passwordHash = hashPassword(newPassword);
      target.passwordUpdatedAt = now;
      target.updatedAt = now;
    }
    if (invalidateOtherSessions) {
      db.sessions = db.sessions.filter((s) => s.userId !== user.id || s.id === ctx.sessionId);
    }
  });
  recordSecurityEvent(req, ctx.organisation?.id || null, user.email, 'PASSWORD_CHANGED', 'INFO', 'Password changed from account settings.');
  return res.json({ ok: true });
});

accountRouter.get('/api/users/me/storage', requireAuth, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const mailbox = ctx.mailbox;
  const messages = mailbox ? db.messages.filter((m) => m.mailboxId === mailbox.id) : [];
  const totalBytes = messages.reduce((sum, m) => sum + (m.sizeBytes || 0), 0);
  const attachments = mailbox ? db.attachments.filter((a) => a.mailboxId === mailbox.id) : [];
  return res.json({
    hasMailbox: Boolean(mailbox),
    quotaMb: mailbox?.quotaMb ?? 0,
    usedMb: mailbox?.usedMb ?? 0,
    breakdown: {
      messageCount: messages.length,
      messageBytes: totalBytes,
      attachmentCount: attachments.length,
      attachmentBytes: attachments.reduce((sum, a) => sum + (a.sizeBytes || 0), 0),
      draftsCount: mailbox ? db.drafts.filter((d) => d.mailboxId === mailbox.id).length : 0,
    },
  });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

accountRouter.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  const userId = currentUser(req).id;
  const notifications = getDb().notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return res.json({ notifications });
});

accountRouter.post('/api/notifications/all/read', requireAuth, (req: AuthedRequest, res) => {
  const userId = currentUser(req).id;
  let updated = 0;
  updateDb((db) => {
    for (const n of db.notifications) {
      if (n.userId === userId && !n.isRead) {
        n.isRead = true;
        updated += 1;
      }
    }
  });
  return res.json({ ok: true, updated });
});

accountRouter.post('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
  const userId = currentUser(req).id;
  const id = req.params.id;
  const notification = getDb().notifications.find((n) => n.id === id && n.userId === userId);
  if (!notification) return res.status(404).json({ error: 'Notification not found.' });
  updateDb((db) => {
    const target = db.notifications.find((n) => n.id === id);
    if (target) target.isRead = true;
  });
  return res.json({ ok: true, notification: { ...notification, isRead: true } });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

accountRouter.post('/api/onboarding/organisation', requireAuth, (req: AuthedRequest, res) => {
  const parsed = organisationSetupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid organisation setup.' });
  }
  const ctx = req.auth!;
  if (!ctx.organisation || ctx.membership?.roleKey !== 'OWNER') {
    return res.status(403).json({ error: 'Only the organisation owner can complete setup.' });
  }
  const orgId = ctx.organisation.id;
  const data = parsed.data;
  updateDb((db) => {
    const org = db.organisations.find((o) => o.id === orgId);
    if (!org) return;
    org.name = data.name;
    org.legalName = data.legalName || data.name;
    org.businessCategory = data.businessCategory;
    org.country = data.country;
    org.size = data.size;
    org.website = data.website;
    org.contactEmail = data.contactEmail;
    org.contactPhone = data.contactPhone;
    org.address = data.address;
    org.timezone = data.timezone;
    org.updatedAt = new Date().toISOString();
  });
  recordAudit(req, orgId, ctx.user.id, ctx.user.email, 'ORGANISATION_ONBOARDING_PROFILE', '/api/onboarding/organisation', 'SUCCESS', 'ADMIN_ACTIVITY');
  return res.json({ organisation: getDb().organisations.find((o) => o.id === orgId) });
});

accountRouter.post('/api/onboarding/complete', requireAuth, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  if (!ctx.organisation || ctx.membership?.roleKey !== 'OWNER') {
    return res.status(403).json({ error: 'Only the organisation owner can complete onboarding.' });
  }
  const orgId = ctx.organisation.id;
  updateDb((db) => {
    const org = db.organisations.find((o) => o.id === orgId);
    if (!org) return;
    org.onboardingComplete = true;
    org.updatedAt = new Date().toISOString();
  });
  recordAudit(req, orgId, ctx.user.id, ctx.user.email, 'ONBOARDING_COMPLETED', '/api/onboarding/complete', 'SUCCESS', 'ADMIN_ACTIVITY');
  return res.json({ organisation: getDb().organisations.find((o) => o.id === orgId), ok: true });
});

export default accountRouter;
