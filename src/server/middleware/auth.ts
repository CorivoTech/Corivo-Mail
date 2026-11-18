import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import type {
  AuthSessionPayload,
  Mailbox,
  Organisation,
  OrganisationMembership,
  PermissionKey,
  PublicUser,
  User,
} from '../../shared/types.ts';
import { getDb, updateDb } from '../db/store.ts';
import { hashToken, parseClientContext } from '../security/password.ts';
import { getPermissionsForRole } from '../security/permissions.ts';

export const SESSION_COOKIE_NAME = 'corivo_session';

export interface AuthenticatedContext {
  user: User;
  publicUser: PublicUser;
  organisation: Organisation | null;
  membership: OrganisationMembership | null;
  mailbox: Mailbox | null;
  permissions: PermissionKey[];
  sessionId: string;
}

export interface AuthedRequest extends Request {
  auth?: AuthenticatedContext;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(key: string, maxAttempts = 8, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function clearLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}

export function sanitizeUser(user: User): PublicUser {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

export function resolveSessionContext(req: Request): AuthenticatedContext | null {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (!rawToken || typeof rawToken !== 'string') return null;

  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const session = db.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    updateDb((d) => {
      d.sessions = d.sessions.filter((s) => s.id !== session.id);
    });
    return null;
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user || user.status === 'SUSPENDED') {
    return null;
  }

  const membership = db.memberships.find((m) => m.userId === user.id && m.status === 'ACTIVE') || null;
  const organisation = membership
    ? db.organisations.find((o) => o.id === membership.organisationId) || null
    : null;

  if (organisation && organisation.status === 'SUSPENDED' && !user.isPlatformAdmin) {
    return null;
  }

  const mailbox = membership
    ? db.mailboxes.find((mb) => mb.userId === user.id && mb.organisationId === membership.organisationId) || null
    : null;

  const customOverrides = organisation ? db.roleOverrides[organisation.id] : undefined;
  const permissions = membership ? getPermissionsForRole(membership.roleKey, customOverrides) : [];

  // Touch lastActiveAt gently if > 60s old
  if (Date.now() - new Date(session.lastActiveAt).getTime() > 60_000) {
    updateDb((d) => {
      const target = d.sessions.find((s) => s.id === session.id);
      if (target) target.lastActiveAt = new Date().toISOString();
    });
  }

  return {
    user,
    publicUser: sanitizeUser(user),
    organisation,
    membership,
    mailbox,
    permissions,
    sessionId: session.id,
  };
}

export function buildSessionPayload(ctx: AuthenticatedContext): AuthSessionPayload {
  const db = getDb();
  const preferences =
    db.userPreferences.find((p) => p.userId === ctx.user.id) || {
      id: `pref-${ctx.user.id}`,
      userId: ctx.user.id,
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
      updatedAt: new Date().toISOString(),
    };

  return {
    user: ctx.publicUser,
    organisation: ctx.organisation,
    membership: ctx.membership,
    mailbox: ctx.mailbox,
    permissions: ctx.permissions,
    preferences,
    runtimeMode: process.env.CORIVO_RUNTIME_MODE === 'production' ? 'PRODUCTION' : 'DEVELOPMENT_SIMULATED',
    sessionId: ctx.sessionId,
  };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const ctx = resolveSessionContext(req);
  if (!ctx) {
    return res.status(401).json({ error: 'Authentication required or session expired.' });
  }
  req.auth = ctx;
  next();
}

export function requireOrganisationMember(req: AuthedRequest, res: Response, next: NextFunction) {
  const ctx = req.auth;
  if (!ctx || !ctx.organisation || !ctx.membership) {
    return res.status(403).json({ error: 'Active organisation membership required.' });
  }
  if (ctx.organisation.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'This organisation is currently suspended.' });
  }
  next();
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const ctx = req.auth;
    if (!ctx || !ctx.organisation || !ctx.membership) {
      return res.status(403).json({ error: 'Organisation access denied.' });
    }
    if (!ctx.permissions.includes(permission)) {
      recordAudit(req, ctx.organisation.id, ctx.user.id, ctx.user.email, `DENIED_${permission}`, req.path, 'DENIED', 'ADMIN_ACTIVITY');
      return res.status(403).json({ error: `Insufficient permissions (${permission} required).` });
    }
    next();
  };
}

export function requireOrgOwner(req: AuthedRequest, res: Response, next: NextFunction) {
  const ctx = req.auth;
  if (!ctx || !ctx.membership || ctx.membership.roleKey !== 'OWNER') {
    return res.status(403).json({ error: 'Only the Organisation Owner can perform this operation.' });
  }
  next();
}

export function requirePlatformAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const ctx = req.auth;
  if (!ctx || !ctx.user.isPlatformAdmin) {
    return res.status(403).json({ error: 'Platform Super Admin authorization required.' });
  }
  const db = getDb();
  const op = db.platformOperators.find((o) => o.userId === ctx.user.id);
  if (!op || op.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Platform operator account is suspended or inactive.' });
  }
  next();
}

export function requirePlatformScope(allowedScopes: Array<'FULL_OPERATOR' | 'HEALTH_READONLY' | 'ORG_SUPPORT'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const ctx = req.auth;
    if (!ctx || !ctx.user.isPlatformAdmin) {
      return res.status(403).json({ error: 'Platform authorization required.' });
    }
    const db = getDb();
    const op = db.platformOperators.find((o) => o.userId === ctx.user.id);
    if (!op || op.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Platform operator account is suspended or inactive.' });
    }
    if (!allowedScopes.includes(op.scope)) {
      recordAudit(req, null, ctx.user.id, ctx.user.email, `DENIED_PLATFORM_${op.scope}`, req.path, 'DENIED', 'PLATFORM_AUDIT');
      return res.status(403).json({ error: `Operator scope (${op.scope}) is read-only or insufficient for this action.` });
    }
    next();
  };
}

export function recordAudit(
  req: Request,
  organisationId: string | null,
  actorId: string | null,
  actorEmail: string,
  action: string,
  resource: string,
  result: 'SUCCESS' | 'DENIED' | 'FAILED',
  category: 'ADMIN_ACTIVITY' | 'COMPLIANCE_AUDIT' | 'PLATFORM_AUDIT'
) {
  const { ipAddress } = parseClientContext(req);
  updateDb((db) => {
    db.auditLogs.unshift({
      id: crypto.randomUUID(),
      organisationId,
      actorId,
      actorEmail,
      action,
      resource,
      ipAddress,
      result,
      category,
      createdAt: new Date().toISOString(),
    });
  });
}

export function recordSecurityEvent(
  req: Request,
  organisationId: string | null,
  actorEmail: string,
  eventType:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'ACCOUNT_SUSPENDED_ATTEMPT'
    | 'PASSWORD_CHANGED'
    | 'SESSION_REVOKED'
    | 'SPAM_BLOCKED'
    | 'MALWARE_QUARANTINED'
    | 'RATE_LIMIT_TRIGGERED',
  severity: 'INFO' | 'WARNING' | 'CRITICAL',
  summary: string
) {
  const { ipAddress } = parseClientContext(req);
  updateDb((db) => {
    db.securityEvents.unshift({
      id: crypto.randomUUID(),
      organisationId,
      actorEmail,
      eventType,
      severity,
      ipAddress,
      summary,
      createdAt: new Date().toISOString(),
    });
  });
}
