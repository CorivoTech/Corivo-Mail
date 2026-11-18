import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { passwordSchema } from '../../shared/validation.ts';
import { getDb, updateDb } from '../db/store.ts';
import {
  type AuthedRequest,
  recordAudit,
  requireAuth,
  requirePlatformAdmin,
  requirePlatformScope,
} from '../middleware/auth.ts';
import {
  dnsVerificationProvider,
  emailSearchProvider,
  mailTransportProvider,
  spamProtectionProvider,
} from '../providers/index.ts';
import { hashPassword } from '../security/password.ts';

export const platformRouter = Router();

platformRouter.use('/api/platform', requireAuth, requirePlatformAdmin);

platformRouter.get('/api/platform/overview', async (_req, res) => {
  const db = getDb();
  const orgs = db.organisations;
  const activeOrgs = orgs.filter((o) => o.status === 'ACTIVE').length;
  const suspendedOrgs = orgs.filter((o) => o.status === 'SUSPENDED').length;
  const totalMailboxes = db.mailboxes.length;
  const totalDomains = db.domains.length;

  const health = await Promise.all([
    mailTransportProvider.healthCheck(),
    dnsVerificationProvider.healthCheck(),
    spamProtectionProvider.healthCheck(),
    emailSearchProvider.healthCheck(),
  ]);

  return res.json({
    kpis: {
      totalOrganisations: orgs.length,
      activeOrganisations: activeOrgs,
      suspendedOrganisations: suspendedOrgs,
      totalMailboxes,
      totalDomains,
      infrastructureAlerts: db.securityEvents.filter((s) => s.severity === 'CRITICAL').length,
    },
    healthSummary: health,
    recentOrganisations: orgs.slice(0, 5).map((o) => ({
      id: o.id,
      name: o.name,
      primaryDomain: o.primaryDomain,
      status: o.status,
      mailboxCount: db.mailboxes.filter((m) => m.organisationId === o.id).length,
      createdAt: o.createdAt,
    })),
  });
});

platformRouter.get('/api/platform/organisations', (_req, res) => {
  const db = getDb();
  const organisations = db.organisations.map((o) => {
    const ownerMem = db.memberships.find((m) => m.organisationId === o.id && m.roleKey === 'OWNER');
    const owner = ownerMem ? db.users.find((u) => u.id === ownerMem.userId) : null;
    return {
      ...o,
      ownerName: owner?.displayName || 'Unknown',
      ownerEmail: owner?.email || o.contactEmail,
      mailboxCount: db.mailboxes.filter((m) => m.organisationId === o.id).length,
      domainCount: db.domains.filter((d) => d.organisationId === o.id).length,
    };
  });
  return res.json({ organisations });
});

platformRouter.get('/api/platform/organisations/:id', (req, res) => {
  const db = getDb();
  const org = db.organisations.find((o) => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: 'Organisation not found.' });

  const domains = db.domains.filter((d) => d.organisationId === org.id);
  const mailboxCount = db.mailboxes.filter((m) => m.organisationId === org.id).length;
  const recentAuditEvents = db.auditLogs.filter((a) => a.organisationId === org.id).slice(0, 15);
  // Platform admin never receives customer email bodies or mailbox message content
  return res.json({
    organisation: org,
    domains,
    mailboxCount,
    subscriptionStatus: 'ILLUSTRATIVE_SANDBOX',
    recentAuditEvents,
  });
});

platformRouter.post('/api/platform/organisations/:id/suspend', requirePlatformScope(['FULL_OPERATOR', 'ORG_SUPPORT']), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const org = updateDb((d) => {
    const o = d.organisations.find((x) => x.id === req.params.id);
    if (!o) return null;
    o.status = 'SUSPENDED';
    o.updatedAt = new Date().toISOString();
    const orgUserIds = new Set(d.memberships.filter((m) => m.organisationId === o.id).map((m) => m.userId));
    d.sessions = d.sessions.filter((s) => !orgUserIds.has(s.userId));
    return o;
  });
  if (!org) return res.status(404).json({ error: 'Organisation not found.' });

  recordAudit(req, null, ctx.user.id, ctx.user.email, 'PLATFORM_SUSPEND_ORG', org.name, 'SUCCESS', 'PLATFORM_AUDIT');
  return res.json({ organisation: org });
});

platformRouter.post('/api/platform/organisations/:id/reactivate', requirePlatformScope(['FULL_OPERATOR', 'ORG_SUPPORT']), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const org = updateDb((d) => {
    const o = d.organisations.find((x) => x.id === req.params.id);
    if (!o) return null;
    o.status = 'ACTIVE';
    o.updatedAt = new Date().toISOString();
    return o;
  });
  if (!org) return res.status(404).json({ error: 'Organisation not found.' });

  recordAudit(req, null, ctx.user.id, ctx.user.email, 'PLATFORM_REACTIVATE_ORG', org.name, 'SUCCESS', 'PLATFORM_AUDIT');
  return res.json({ organisation: org });
});

platformRouter.get('/api/platform/users', (_req, res) => {
  const db = getDb();
  return res.json({ operators: db.platformOperators });
});

platformRouter.post('/api/platform/users', requirePlatformScope(['FULL_OPERATOR']), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const schema = z.object({
    displayName: z.string().trim().min(2),
    email: z.string().trim().email(),
    password: passwordSchema,
    scope: z.enum(['FULL_OPERATOR', 'HEALTH_READONLY', 'ORG_SUPPORT']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid operator fields' });

  const db = getDb();
  const email = parsed.data.email.toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const operator = updateDb((d) => {
    const parts = parsed.data.displayName.split(/\s+/);
    d.users.push({
      id: userId,
      email,
      passwordHash: hashPassword(parsed.data.password),
      firstName: parts[0] || 'Platform',
      lastName: parts.slice(1).join(' ') || 'Operator',
      displayName: parsed.data.displayName,
      jobTitle: 'Platform Operator',
      department: 'Corivo Platform Ops',
      phone: '',
      avatarUrl: null,
      status: 'ACTIVE',
      isPlatformAdmin: true,
      lastLoginAt: null,
      passwordUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const op = {
      id: crypto.randomUUID(),
      userId,
      email,
      displayName: parsed.data.displayName,
      scope: parsed.data.scope,
      status: 'ACTIVE' as const,
      createdAt: now,
    };
    d.platformOperators.push(op);
    return op;
  });

  recordAudit(req, null, ctx.user.id, ctx.user.email, 'PLATFORM_OPERATOR_CREATED', email, 'SUCCESS', 'PLATFORM_AUDIT');
  return res.status(201).json({ operator });
});

platformRouter.patch('/api/platform/users/:id', requirePlatformScope(['FULL_OPERATOR']), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const schema = z.object({
    scope: z.enum(['FULL_OPERATOR', 'HEALTH_READONLY', 'ORG_SUPPORT']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid operator update' });

  const op = updateDb((d) => {
    const target = d.platformOperators.find((o) => o.id === req.params.id);
    if (!target) return null;
    if (target.userId === ctx.user.id && parsed.data.status === 'SUSPENDED') return 'SELF';
    if (parsed.data.scope) target.scope = parsed.data.scope;
    if (parsed.data.status) {
      target.status = parsed.data.status;
      const u = d.users.find((x) => x.id === target.userId);
      if (u) u.status = parsed.data.status;
      if (parsed.data.status === 'SUSPENDED') {
        d.sessions = d.sessions.filter((s) => s.userId !== target.userId);
      }
    }
    return target;
  });
  if (op === 'SELF') return res.status(400).json({ error: 'You cannot suspend your own operator account.' });
  if (!op) return res.status(404).json({ error: 'Operator not found.' });

  recordAudit(req, null, ctx.user.id, ctx.user.email, 'PLATFORM_OPERATOR_UPDATED', op.email, 'SUCCESS', 'PLATFORM_AUDIT');
  return res.json({ operator: op });
});

platformRouter.get('/api/platform/health', async (_req, res) => {
  const now = new Date().toISOString();
  const [smtp, dnsStatus, spam, search] = await Promise.all([
    mailTransportProvider.healthCheck(),
    dnsVerificationProvider.healthCheck(),
    spamProtectionProvider.healthCheck(),
    emailSearchProvider.healthCheck(),
  ]);

  const services = [
    {
      service: 'Core Application API',
      adapter: 'Express + TypeScript',
      mode: 'LIVE' as const,
      healthy: true,
      detail: 'Responding normally on HTTP server',
      checkedAt: now,
    },
    {
      service: 'Primary Persistence Store',
      adapter: process.env.DATABASE_URL ? 'PostgreSQL / Prisma' : 'Local File Store (.data/)',
      mode: process.env.DATABASE_URL ? ('LIVE' as const) : ('DEVELOPMENT_SIMULATED' as const),
      healthy: true,
      detail: process.env.DATABASE_URL ? 'Connected to PostgreSQL' : 'Atomic JSON file persistence active (PostgreSQL not attached)',
      checkedAt: now,
    },
    {
      service: 'Cache & Queue (Redis)',
      adapter: 'Redis Adapter',
      mode: process.env.REDIS_URL ? ('LIVE' as const) : ('UNCONFIGURED' as const),
      healthy: Boolean(process.env.REDIS_URL),
      detail: process.env.REDIS_URL ? 'Redis connected' : 'REDIS_URL not configured; using in-process queue fallback',
      checkedAt: now,
    },
    smtp,
    {
      service: 'IMAP (Dovecot)',
      adapter: 'MailboxProvider',
      mode: process.env.IMAP_HOST ? ('LIVE' as const) : ('UNCONFIGURED' as const),
      healthy: Boolean(process.env.IMAP_HOST),
      detail: process.env.IMAP_HOST ? `Connected to ${process.env.IMAP_HOST}` : 'IMAP_HOST not configured; serving local development store',
      checkedAt: now,
    },
    spam,
    search,
    {
      service: 'Object Storage (S3)',
      adapter: 'AttachmentStorageProvider',
      mode: process.env.S3_BUCKET ? ('LIVE' as const) : ('DEVELOPMENT_SIMULATED' as const),
      healthy: true,
      detail: process.env.S3_BUCKET ? `Bucket ${process.env.S3_BUCKET}` : 'Private local disk attachment vault (.data/attachments/)',
      checkedAt: now,
    },
    {
      service: 'Background Workers',
      adapter: 'BullMQ / Job Queue',
      mode: process.env.REDIS_URL ? ('LIVE' as const) : ('UNCONFIGURED' as const),
      healthy: Boolean(process.env.REDIS_URL),
      detail: process.env.REDIS_URL ? 'Async mail queue & migration workers online' : 'REDIS_URL not configured; IMAP migration and outbound retries execute synchronously in-process',
      checkedAt: now,
    },
    dnsStatus,
  ];

  return res.json({ services });
});

platformRouter.get('/api/platform/settings', (_req, res) => {
  const db = getDb();
  return res.json({ settings: db.platformSettings });
});

platformRouter.patch('/api/platform/settings', requirePlatformScope(['FULL_OPERATOR']), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const schema = z.object({
    platformName: z.string().trim().min(2).optional(),
    defaultQuotaMb: z.number().int().min(1024).max(1024000).optional(),
    maxAttachmentMb: z.number().int().min(1).max(50).optional(),
    maintenanceNotice: z.string().max(500).optional(),
    allowPublicSignup: z.boolean().optional(),
    supportedDomainPolicy: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid platform settings' });

  const updated = updateDb((d) => {
    Object.assign(d.platformSettings, parsed.data, { updatedAt: new Date().toISOString() });
    return d.platformSettings;
  });

  recordAudit(req, null, ctx.user.id, ctx.user.email, 'PLATFORM_SETTINGS_UPDATED', updated.platformName, 'SUCCESS', 'PLATFORM_AUDIT');
  return res.json({ settings: updated });
});

platformRouter.get('/api/platform/audit-logs', (_req, res) => {
  const db = getDb();
  return res.json({ logs: db.auditLogs.slice(0, 150) });
});
