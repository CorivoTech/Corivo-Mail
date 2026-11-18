import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { PermissionKey, RoleKey } from '../../shared/types.ts';
import {
  addDomainSchema,
  avatarDataUriRegex,
  createMailboxSchema,
  isValidIanaTimezone,
  passwordSchema,
} from '../../shared/validation.ts';
import { getDb, updateDb } from '../db/store.ts';
import {
  type AuthedRequest,
  recordAudit,
  recordSecurityEvent,
  requireAuth,
  requireOrgOwner,
  requireOrganisationMember,
  requirePermission,
} from '../middleware/auth.ts';
import { dnsVerificationProvider } from '../providers/index.ts';
import { hashPassword } from '../security/password.ts';
import { ALL_PERMISSIONS, DEFAULT_ROLES, getPermissionsForRole } from '../security/permissions.ts';

export const adminRouter = Router();

// --- Organisation Profile, Members, Preferences, Security, Notifications ---

adminRouter.get('/api/organisations/current', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const settings = db.organisationSettings.find((s) => s.organisationId === ctx.organisation!.id) || null;
  return res.json({ organisation: ctx.organisation, settings });
});

adminRouter.get('/api/organisations/members', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const orgId = ctx.organisation!.id;
  const members = db.memberships
    .filter((m) => m.organisationId === orgId)
    .map((m) => {
      const user = db.users.find((u) => u.id === m.userId);
      const mailbox = db.mailboxes.find((mb) => mb.userId === m.userId && mb.organisationId === orgId);
      return {
        id: m.id,
        userId: m.userId,
        roleKey: m.roleKey,
        status: m.status,
        displayName: user?.displayName || 'Unknown',
        email: mailbox?.emailAddress || user?.email || '',
        department: user?.department || '',
        jobTitle: user?.jobTitle || '',
        avatarUrl: user?.avatarUrl || null,
      };
    });
  return res.json({ members });
});

adminRouter.patch(
  '/api/organisations/current',
  requireAuth,
  requireOrganisationMember,
  requirePermission('organisation.settings'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const schema = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      legalName: z.string().trim().max(150).optional(),
      businessCategory: z.string().trim().max(100).optional(),
      country: z.string().trim().max(80).optional(),
      size: z.string().trim().max(60).optional(),
      primaryDomain: z.string().trim().nullable().optional(),
      website: z.string().trim().max(200).optional(),
      contactEmail: z.string().trim().email().optional(),
      contactPhone: z.string().trim().max(40).optional(),
      address: z.string().trim().max(300).optional(),
      timezone: z
        .string()
        .trim()
        .max(80)
        .refine((val) => isValidIanaTimezone(val), 'Invalid IANA timezone identifier')
        .optional(),
      logoUrl: z
        .string()
        .max(500_000, 'Organisation logo exceeds 500 KB limit')
        .regex(avatarDataUriRegex, 'Logo must be a valid base64 PNG, JPG, WebP, or SVG image')
        .nullable()
        .optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid organisation profile data' });
    }

    // Legal/primaryDomain changes restricted strictly to OWNER
    if (
      (parsed.data.legalName !== undefined || parsed.data.primaryDomain !== undefined) &&
      ctx.membership?.roleKey !== 'OWNER'
    ) {
      return res.status(403).json({ error: 'Only the Organisation Owner can change legal name or primary domain.' });
    }

    const updated = updateDb((d) => {
      const org = d.organisations.find((o) => o.id === ctx.organisation!.id)!;
      Object.assign(org, parsed.data, { updatedAt: new Date().toISOString() });
      return org;
    });

    recordAudit(req, updated.id, ctx.user.id, ctx.user.email, 'ORGANISATION_PROFILE_UPDATED', updated.name, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.json({ organisation: updated });
  }
);

adminRouter.patch(
  '/api/organisations/settings',
  requireAuth,
  requireOrganisationMember,
  requirePermission('organisation.settings'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const schema = z.object({
      defaultLanguage: z.string().optional(),
      defaultTimezone: z
        .string()
        .trim()
        .max(80)
        .refine((val) => isValidIanaTimezone(val), 'Invalid IANA timezone identifier')
        .optional(),
      dateFormat: z.string().optional(),
      defaultQuotaMb: z.number().int().min(1024).max(1024000).optional(),
      defaultRoleKey: z.enum(['ADMIN', 'MAILBOX_USER']).optional(),
      minPasswordLength: z.number().int().min(8).max(32).optional(),
      requireComplexity: z.boolean().optional(),
      sessionTimeoutHours: z.number().int().min(1).max(720).optional(),
      maxLoginAttempts: z.number().int().min(3).max(20).optional(),
      enforce2fa: z.boolean().optional(),
      notifyDomainAlerts: z.boolean().optional(),
      notifyQuotaWarnings: z.boolean().optional(),
      notifySecurity: z.boolean().optional(),
      notifyDelivery: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid organisation settings payload' });

    if (
      (parsed.data.minPasswordLength !== undefined ||
        parsed.data.requireComplexity !== undefined ||
        parsed.data.sessionTimeoutHours !== undefined ||
        parsed.data.enforce2fa !== undefined ||
        parsed.data.maxLoginAttempts !== undefined) &&
      !ctx.permissions.includes('security.manage')
    ) {
      return res.status(403).json({ error: 'Security management permission required to modify security policies.' });
    }

    const updated = updateDb((d) => {
      let s = d.organisationSettings.find((x) => x.organisationId === ctx.organisation!.id);
      if (!s) {
        s = {
          id: crypto.randomUUID(),
          organisationId: ctx.organisation!.id,
          defaultLanguage: 'en-IN',
          defaultTimezone: 'Asia/Kolkata',
          dateFormat: 'DD/MM/YYYY',
          defaultQuotaMb: 10240,
          defaultRoleKey: 'MAILBOX_USER',
          minPasswordLength: 10,
          requireComplexity: true,
          sessionTimeoutHours: 24,
          maxLoginAttempts: 5,
          enforce2fa: false,
          notifyDomainAlerts: true,
          notifyQuotaWarnings: true,
          notifySecurity: true,
          notifyDelivery: true,
          updatedAt: new Date().toISOString(),
        };
        d.organisationSettings.push(s);
      }
      Object.assign(s, parsed.data, { updatedAt: new Date().toISOString() });
      return s;
    });

    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'ORGANISATION_SETTINGS_UPDATED', ctx.organisation!.name, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.json({ settings: updated });
  }
);

// --- Domains & DNS Management ---

adminRouter.get('/api/domains', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const domains = db.domains
    .filter((dom) => dom.organisationId === ctx.organisation!.id)
    .map((dom) => ({
      ...dom,
      mailboxCount: db.mailboxes.filter((mb) => mb.domainId === dom.id).length,
      dnsRecords: db.dnsRecords.filter((r) => r.domainId === dom.id),
    }));
  return res.json({ domains });
});

adminRouter.post(
  '/api/domains',
  requireAuth,
  requireOrganisationMember,
  requirePermission('domains.manage'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const parsed = addDomainSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid domain format' });
    }

    const domainName = parsed.data.domainName.toLowerCase();
    const db = getDb();
    if (db.domains.some((d) => d.domainName.toLowerCase() === domainName)) {
      return res.status(409).json({ error: 'This domain is already registered on Corivo Mail.' });
    }

    const now = new Date().toISOString();
    const domainId = crypto.randomUUID();
    const verificationToken = `corivo-verify=${crypto.randomBytes(8).toString('hex')}`;
    const dkimPub = `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${crypto.randomBytes(12).toString('hex')}`;

    const created = updateDb((d) => {
      const existingCount = d.domains.filter((x) => x.organisationId === ctx.organisation!.id).length;
      const isPrimary = parsed.data.isPrimary || existingCount === 0;
      if (isPrimary) {
        d.domains
          .filter((x) => x.organisationId === ctx.organisation!.id)
          .forEach((x) => {
            x.isPrimary = false;
          });
        const org = d.organisations.find((o) => o.id === ctx.organisation!.id);
        if (org) org.primaryDomain = domainName;
      }

      const dom = {
        id: domainId,
        organisationId: ctx.organisation!.id,
        domainName,
        isPrimary,
        ownershipStatus: 'PENDING' as const,
        verificationToken,
        mxStatus: 'PENDING' as const,
        spfStatus: 'PENDING' as const,
        dkimStatus: 'PENDING' as const,
        dmarcStatus: 'PENDING' as const,
        tlsStatus: 'UNKNOWN' as const,
        dkimSelector: 'corivo1',
        dkimPublicKey: dkimPub,
        dkimKeyRef: `kms://corivo-dev/dkim/${domainName}`,
        lastCheckedAt: null,
        verificationMode:
          process.env.DNS_VERIFICATION_MODE === 'live'
            ? ('LIVE_DNS' as const)
            : ('DEVELOPMENT_SIMULATED' as const),
        createdAt: now,
        updatedAt: now,
      };
      d.domains.push(dom);

      const records = [
        { category: 'OWNERSHIP' as const, type: 'TXT' as const, host: '@', value: verificationToken, priority: null },
        { category: 'MX' as const, type: 'MX' as const, host: '@', value: 'mx1.corivomail.example', priority: 10 },
        { category: 'MX' as const, type: 'MX' as const, host: '@', value: 'mx2.corivomail.example', priority: 20 },
        { category: 'SPF' as const, type: 'TXT' as const, host: '@', value: 'v=spf1 include:_spf.corivomail.example ~all', priority: null },
        { category: 'DKIM' as const, type: 'TXT' as const, host: 'corivo1._domainkey', value: dkimPub, priority: null },
        { category: 'DMARC' as const, type: 'TXT' as const, host: '_dmarc', value: `v=DMARC1; p=none; rua=mailto:dmarc@${domainName}`, priority: null },
      ];

      const dnsRecords = records.map((rec) => ({
        id: crypto.randomUUID(),
        domainId,
        category: rec.category,
        type: rec.type,
        host: rec.host,
        value: rec.value,
        priority: rec.priority,
        ttl: 3600,
        status: 'PENDING' as const,
        lastCheckedAt: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      }));
      d.dnsRecords.push(...dnsRecords);
      return { ...dom, dnsRecords, mailboxCount: 0 };
    });

    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'DOMAIN_ADDED', domainName, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.status(201).json({ domain: created });
  }
);

adminRouter.get('/api/domains/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const domain = db.domains.find((d) => d.id === req.params.id && d.organisationId === ctx.organisation!.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found in your organisation.' });

  const dnsRecords = db.dnsRecords.filter((r) => r.domainId === domain.id);
  const mailboxes = db.mailboxes.filter((mb) => mb.domainId === domain.id);
  const activity = db.auditLogs.filter(
    (a) => a.organisationId === ctx.organisation!.id && a.resource.toLowerCase().includes(domain.domainName.toLowerCase())
  );
  return res.json({ domain, dnsRecords, mailboxes, activity });
});

adminRouter.get('/api/domains/:id/dns', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const domain = db.domains.find((d) => d.id === req.params.id && d.organisationId === ctx.organisation!.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found in your organisation.' });

  const dnsRecords = db.dnsRecords.filter((r) => r.domainId === domain.id);
  return res.json({ domain, dnsRecords });
});

adminRouter.patch(
  '/api/domains/:id',
  requireAuth,
  requireOrganisationMember,
  requirePermission('domains.manage'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const schema = z.object({
      isPrimary: z.boolean().optional(),
      dkimSelector: z.string().trim().min(2).max(40).optional(),
      tlsStatus: z.enum(['AVAILABLE', 'ENFORCED', 'UNKNOWN']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid domain configuration payload' });

    const updated = updateDb((d) => {
      const dom = d.domains.find((x) => x.id === req.params.id && x.organisationId === ctx.organisation!.id);
      if (!dom) return null;

      if (parsed.data.isPrimary === true) {
        d.domains
          .filter((x) => x.organisationId === ctx.organisation!.id)
          .forEach((x) => {
            x.isPrimary = false;
          });
        dom.isPrimary = true;
        const org = d.organisations.find((o) => o.id === ctx.organisation!.id);
        if (org) {
          org.primaryDomain = dom.domainName;
          org.updatedAt = new Date().toISOString();
        }
      }
      if (parsed.data.dkimSelector) {
        dom.dkimSelector = parsed.data.dkimSelector;
      }
      if (parsed.data.tlsStatus) {
        dom.tlsStatus = parsed.data.tlsStatus;
      }
      dom.updatedAt = new Date().toISOString();
      return dom;
    });

    if (!updated) return res.status(404).json({ error: 'Domain not found.' });
    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'DOMAIN_UPDATED', updated.domainName, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.json({ domain: updated });
  }
);

adminRouter.post(
  '/api/domains/:id/verify',
  requireAuth,
  requireOrganisationMember,
  requirePermission('domains.manage'),
  async (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const db = getDb();
    const domain = db.domains.find((d) => d.id === req.params.id && d.organisationId === ctx.organisation!.id);
    if (!domain) return res.status(404).json({ error: 'Domain not found.' });

    const check = await dnsVerificationProvider.verifyOwnership(domain);

    const updated = updateDb((d) => {
      const dom = d.domains.find((x) => x.id === domain.id)!;
      dom.ownershipStatus = check.status;
      dom.verificationMode = check.mode;
      dom.lastCheckedAt = check.checkedAt;
      dom.updatedAt = check.checkedAt;

      const ownershipRecord = d.dnsRecords.find((r) => r.domainId === domain.id && r.category === 'OWNERSHIP');
      if (ownershipRecord) {
        ownershipRecord.status = check.status;
        ownershipRecord.lastCheckedAt = check.checkedAt;
        ownershipRecord.errorMessage = check.errorMessage;
      }

      if (check.status === 'VERIFIED') {
        d.notifications.unshift({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          title: 'Domain verification completed',
          message: `${dom.domainName} ownership TXT record was verified (${check.mode === 'DEVELOPMENT_SIMULATED' ? 'Development Simulator' : 'Live DNS'}).`,
          severity: 'SUCCESS',
          isRead: false,
          createdAt: check.checkedAt,
        });
      }
      return dom;
    });

    recordAudit(
      req,
      ctx.organisation!.id,
      ctx.user.id,
      ctx.user.email,
      'DOMAIN_OWNERSHIP_CHECKED',
      `${domain.domainName} -> ${check.status}`,
      check.status === 'VERIFIED' ? 'SUCCESS' : 'FAILED',
      'ADMIN_ACTIVITY'
    );

    return res.json({ domain: updated, check });
  }
);

adminRouter.post(
  '/api/domains/:id/dns/check',
  requireAuth,
  requireOrganisationMember,
  requirePermission('domains.manage'),
  async (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const db = getDb();
    const domain = db.domains.find((d) => d.id === req.params.id && d.organisationId === ctx.organisation!.id);
    if (!domain) return res.status(404).json({ error: 'Domain not found.' });

    const records = db.dnsRecords.filter((r) => r.domainId === domain.id);
    const results = await Promise.all(
      records.map(async (rec) => ({
        recordId: rec.id,
        category: rec.category,
        result:
          rec.category === 'OWNERSHIP'
            ? await dnsVerificationProvider.verifyOwnership(domain)
            : await dnsVerificationProvider.verifyRecord(domain, rec),
      }))
    );

    const updated = updateDb((d) => {
      const dom = d.domains.find((x) => x.id === domain.id)!;
      const now = new Date().toISOString();
      for (const item of results) {
        const rec = d.dnsRecords.find((r) => r.id === item.recordId);
        if (rec) {
          rec.status = item.result.status;
          rec.lastCheckedAt = item.result.checkedAt;
          rec.errorMessage = item.result.errorMessage;
          rec.updatedAt = now;
        }
      }

      const domRecords = d.dnsRecords.filter((r) => r.domainId === domain.id);
      const statusFor = (cat: string) => {
        const subset = domRecords.filter((r) => r.category === cat);
        if (subset.some((r) => r.status === 'FAILED')) return 'FAILED';
        if (subset.every((r) => r.status === 'VERIFIED')) return 'VERIFIED';
        return 'PENDING';
      };

      dom.ownershipStatus = statusFor('OWNERSHIP');
      dom.mxStatus = statusFor('MX');
      dom.spfStatus = statusFor('SPF');
      dom.dkimStatus = statusFor('DKIM');
      dom.dmarcStatus = statusFor('DMARC');
      dom.tlsStatus = dom.mxStatus === 'VERIFIED' ? 'AVAILABLE' : 'UNKNOWN';
      dom.lastCheckedAt = now;
      dom.updatedAt = now;

      return { domain: dom, dnsRecords: domRecords };
    });

    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'DOMAIN_DNS_CHECKED', domain.domainName, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.json(updated);
  }
);

adminRouter.delete(
  '/api/domains/:id',
  requireAuth,
  requireOrganisationMember,
  requirePermission('domains.manage'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const db = getDb();
    const dom = db.domains.find((d) => d.id === req.params.id && d.organisationId === ctx.organisation!.id);
    if (!dom) return res.status(404).json({ error: 'Domain not found.' });
    if (db.mailboxes.some((mb) => mb.domainId === dom.id)) {
      return res.status(400).json({ error: 'Remove or reassign all mailboxes on this domain before deleting it.' });
    }

    updateDb((d) => {
      d.domains = d.domains.filter((x) => x.id !== dom.id);
      d.dnsRecords = d.dnsRecords.filter((r) => r.domainId !== dom.id);
    });
    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'DOMAIN_REMOVED', dom.domainName, 'SUCCESS', 'COMPLIANCE_AUDIT');
    return res.json({ ok: true });
  }
);

// --- Mailboxes Management ---

adminRouter.get('/api/mailboxes', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : 'ALL';

  let list = db.mailboxes.filter((mb) => mb.organisationId === ctx.organisation!.id);
  if (status !== 'ALL') list = list.filter((mb) => mb.status === status);
  if (q) {
    list = list.filter(
      (mb) => mb.emailAddress.toLowerCase().includes(q) || mb.displayName.toLowerCase().includes(q)
    );
  }

  const enriched = list.map((mb) => {
    const domain = db.domains.find((d) => d.id === mb.domainId);
    const user = db.users.find((u) => u.id === mb.userId);
    return {
      ...mb,
      domainName: domain?.domainName || '',
      department: user?.department || '',
      jobTitle: user?.jobTitle || '',
    };
  });

  return res.json({ mailboxes: enriched });
});

adminRouter.post(
  '/api/mailboxes',
  requireAuth,
  requireOrganisationMember,
  requirePermission('mailboxes.create'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const parsed = createMailboxSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid mailbox fields' });
    }

    if (parsed.data.roleKey === 'OWNER' && ctx.membership?.roleKey !== 'OWNER') {
      return res.status(403).json({ error: 'Only an Organisation Owner can create another Owner account.' });
    }

    const db = getDb();
    const domain = db.domains.find((d) => d.id === parsed.data.domainId && d.organisationId === ctx.organisation!.id);
    if (!domain) {
      return res.status(404).json({ error: 'Selected domain does not belong to your organisation.' });
    }

    const emailAddress = `${parsed.data.username}@${domain.domainName}`.toLowerCase();
    if (db.mailboxes.some((m) => m.emailAddress.toLowerCase() === emailAddress) || db.users.some((u) => u.email.toLowerCase() === emailAddress)) {
      return res.status(409).json({ error: `Mailbox ${emailAddress} already exists.` });
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const mailboxId = crypto.randomUUID();
    const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

    const mailbox = updateDb((d) => {
      d.users.push({
        id: userId,
        email: emailAddress,
        passwordHash: hashPassword(parsed.data.password),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        displayName,
        jobTitle: '',
        department: '',
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
        organisationId: ctx.organisation!.id,
        userId,
        roleKey: parsed.data.roleKey,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });

      const mb = {
        id: mailboxId,
        organisationId: ctx.organisation!.id,
        domainId: domain.id,
        userId,
        username: parsed.data.username,
        emailAddress,
        displayName,
        roleKey: parsed.data.roleKey,
        status: 'ACTIVE' as const,
        quotaMb: parsed.data.quotaMb,
        usedMb: 0,
        lastActivityAt: null,
        createdAt: now,
        updatedAt: now,
      };
      d.mailboxes.push(mb);

      const sysFolders = [
        { name: 'Inbox', slug: 'inbox' },
        { name: 'Sent', slug: 'sent' },
        { name: 'Drafts', slug: 'drafts' },
        { name: 'Starred', slug: 'starred' },
        { name: 'Snoozed', slug: 'snoozed' },
        { name: 'Spam', slug: 'spam' },
        { name: 'Trash', slug: 'trash' },
        { name: 'Archive', slug: 'archive' },
      ];
      for (const f of sysFolders) {
        d.folders.push({
          id: `${mailboxId}-fld-${f.slug}`,
          mailboxId,
          name: f.name,
          slug: f.slug,
          isSystem: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      d.userPreferences.push({
        id: crypto.randomUUID(),
        userId,
        language: 'en-IN',
        timezone: ctx.organisation!.timezone || 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h',
        theme: 'light',
        density: 'comfortable',
        defaultReplyMode: 'reply',
        threadingEnabled: true,
        readingPane: 'right',
        defaultFont: 'DM Sans',
        confirmBeforeSend: false,
        signatureHtml: `<p><strong>${displayName}</strong><br/>${ctx.organisation!.name}<br/>${emailAddress}</p>`,
        signatureEnabled: true,
        newEmailAlerts: true,
        browserNotifications: false,
        securityAlerts: true,
        productAnnouncements: false,
        updatedAt: now,
      });

      d.messages.unshift({
        id: crypto.randomUUID(),
        organisationId: ctx.organisation!.id,
        mailboxId,
        folderSlug: 'inbox',
        threadId: crypto.randomUUID(),
        externalStoreId: `dovecot://${domain.domainName}/${parsed.data.username}/welcome`,
        fromName: 'Corivo Mail Workspace',
        fromAddress: `admin@${domain.domainName}`,
        toAddresses: [emailAddress],
        ccAddresses: [],
        bccAddresses: [],
        subject: `Welcome to ${ctx.organisation!.name} on Corivo Mail`,
        snippet: `Your business mailbox ${emailAddress} is active and ready.`,
        bodyHtml: `<p>Hello ${parsed.data.firstName},</p><p>Your professional business mailbox <strong>${emailAddress}</strong> has been provisioned under <strong>${ctx.organisation!.name}</strong>.</p>`,
        isRead: false,
        isStarred: false,
        snoozedUntil: null,
        deliveryStatus: 'RECEIVED',
        spamScore: 0,
        sizeBytes: 2400,
        attachments: [],
        sentAt: now,
        createdAt: now,
        updatedAt: now,
      });

      d.notifications.unshift({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        title: 'Mailbox created successfully',
        message: `${emailAddress} (${Math.round(parsed.data.quotaMb / 1024)} GB quota) is now active.`,
        severity: 'SUCCESS',
        isRead: false,
        createdAt: now,
      });

      return mb;
    });

    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'MAILBOX_CREATED', emailAddress, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.status(201).json({ mailbox });
  }
);

adminRouter.get('/api/mailboxes/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const mb = db.mailboxes.find((m) => m.id === req.params.id && m.organisationId === ctx.organisation!.id);
  if (!mb) return res.status(404).json({ error: 'Mailbox not found.' });
  const domain = db.domains.find((d) => d.id === mb.domainId);
  const user = db.users.find((u) => u.id === mb.userId);
  return res.json({
    mailbox: mb,
    domain,
    user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, jobTitle: user.jobTitle, department: user.department, phone: user.phone, lastLoginAt: user.lastLoginAt } : null,
  });
});

adminRouter.patch(
  '/api/mailboxes/:id',
  requireAuth,
  requireOrganisationMember,
  requirePermission('quotas.change'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const schema = z.object({
      displayName: z.string().trim().min(2).optional(),
      quotaMb: z.number().int().min(1024).max(1024000).optional(),
      roleKey: z.enum(['OWNER', 'ADMIN', 'MAILBOX_USER']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid mailbox update fields' });

    if (parsed.data.roleKey === 'OWNER' && ctx.membership?.roleKey !== 'OWNER') {
      return res.status(403).json({ error: 'Only the Organisation Owner can promote another Owner.' });
    }

    const updated = updateDb((d) => {
      const mb = d.mailboxes.find((m) => m.id === req.params.id && m.organisationId === ctx.organisation!.id);
      if (!mb) return null;
      if (parsed.data.displayName) mb.displayName = parsed.data.displayName;
      if (parsed.data.quotaMb) mb.quotaMb = parsed.data.quotaMb;
      if (parsed.data.roleKey) {
        mb.roleKey = parsed.data.roleKey;
        const mem = d.memberships.find((x) => x.userId === mb.userId && x.organisationId === ctx.organisation!.id);
        if (mem) mem.roleKey = parsed.data.roleKey;
      }
      mb.updatedAt = new Date().toISOString();
      return mb;
    });
    if (!updated) return res.status(404).json({ error: 'Mailbox not found.' });

    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'MAILBOX_UPDATED', updated.emailAddress, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.json({ mailbox: updated });
  }
);

adminRouter.post(
  '/api/mailboxes/:id/suspend',
  requireAuth,
  requireOrganisationMember,
  requirePermission('mailboxes.suspend'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const updated = updateDb((d) => {
      const mb = d.mailboxes.find((m) => m.id === req.params.id && m.organisationId === ctx.organisation!.id);
      if (!mb) return null;
      if (mb.userId === ctx.user.id) return 'SELF';
      mb.status = 'SUSPENDED';
      mb.updatedAt = new Date().toISOString();
      const u = d.users.find((x) => x.id === mb.userId);
      if (u) u.status = 'SUSPENDED';
      d.sessions = d.sessions.filter((s) => s.userId !== mb.userId);
      return mb;
    });
    if (updated === 'SELF') return res.status(400).json({ error: 'You cannot suspend your own active account.' });
    if (!updated) return res.status(404).json({ error: 'Mailbox not found.' });

    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'MAILBOX_SUSPENDED', updated.emailAddress, 'SUCCESS', 'COMPLIANCE_AUDIT');
    return res.json({ mailbox: updated });
  }
);

adminRouter.post(
  '/api/mailboxes/:id/reactivate',
  requireAuth,
  requireOrganisationMember,
  requirePermission('mailboxes.suspend'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const updated = updateDb((d) => {
      const mb = d.mailboxes.find((m) => m.id === req.params.id && m.organisationId === ctx.organisation!.id);
      if (!mb) return null;
      mb.status = 'ACTIVE';
      mb.updatedAt = new Date().toISOString();
      const u = d.users.find((x) => x.id === mb.userId);
      if (u) u.status = 'ACTIVE';
      return mb;
    });
    if (!updated) return res.status(404).json({ error: 'Mailbox not found.' });
    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'MAILBOX_REACTIVATED', updated.emailAddress, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.json({ mailbox: updated });
  }
);

adminRouter.post(
  '/api/mailboxes/:id/reset-password',
  requireAuth,
  requireOrganisationMember,
  requirePermission('users.manage'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const schema = z.object({ newPassword: passwordSchema });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Password does not meet security policy.' });

    const dbCheck = getDb();
    const orgSettings = dbCheck.organisationSettings.find((s) => s.organisationId === ctx.organisation!.id);
    const minLen = Math.max(10, orgSettings?.minPasswordLength ?? 10);
    if (parsed.data.newPassword.length < minLen) {
      return res.status(400).json({ error: `Organisation policy requires at least ${minLen} characters.` });
    }

    const email = updateDb((d) => {
      const mb = d.mailboxes.find((m) => m.id === req.params.id && m.organisationId === ctx.organisation!.id);
      if (!mb) return null;
      const u = d.users.find((x) => x.id === mb.userId);
      if (!u) return null;
      u.passwordHash = hashPassword(parsed.data.newPassword);
      u.passwordUpdatedAt = new Date().toISOString();
      d.sessions = d.sessions.filter((s) => s.userId !== u.id);
      return mb.emailAddress;
    });
    if (!email) return res.status(404).json({ error: 'Mailbox not found.' });

    recordSecurityEvent(req, ctx.organisation!.id, email, 'PASSWORD_CHANGED', 'INFO', `Password reset by administrator ${ctx.user.email}`);
    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'MAILBOX_PASSWORD_RESET', email, 'SUCCESS', 'COMPLIANCE_AUDIT');
    return res.json({ ok: true });
  }
);

adminRouter.delete(
  '/api/mailboxes/:id',
  requireAuth,
  requireOrganisationMember,
  requirePermission('mailboxes.delete'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const email = updateDb((d) => {
      const mb = d.mailboxes.find((m) => m.id === req.params.id && m.organisationId === ctx.organisation!.id);
      if (!mb) return null;
      if (mb.userId === ctx.user.id) return 'SELF';
      d.mailboxes = d.mailboxes.filter((x) => x.id !== mb.id);
      d.messages = d.messages.filter((m) => m.mailboxId !== mb.id);
      d.drafts = d.drafts.filter((dr) => dr.mailboxId !== mb.id);
      d.folders = d.folders.filter((f) => f.mailboxId !== mb.id);
      return mb.emailAddress;
    });
    if (email === 'SELF') return res.status(400).json({ error: 'Cannot delete your own mailbox.' });
    if (!email) return res.status(404).json({ error: 'Mailbox not found.' });
    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'MAILBOX_DELETED', email, 'SUCCESS', 'COMPLIANCE_AUDIT');
    return res.json({ ok: true });
  }
);

// --- Aliases & Distribution Groups ---

adminRouter.get('/api/aliases', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  return res.json({
    aliases: db.aliases.filter((a) => a.organisationId === ctx.organisation!.id),
    groups: db.distributionGroups.filter((g) => g.organisationId === ctx.organisation!.id),
  });
});

adminRouter.post(
  '/api/aliases',
  requireAuth,
  requireOrganisationMember,
  requirePermission('mailboxes.create'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const schema = z.object({
      aliasAddress: z.string().trim().email(),
      targetAddress: z.string().trim().email(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide valid alias and target email addresses.' });

    const now = new Date().toISOString();
    const alias = updateDb((d) => {
      const rec = {
        id: crypto.randomUUID(),
        organisationId: ctx.organisation!.id,
        aliasAddress: parsed.data.aliasAddress.toLowerCase(),
        targetAddress: parsed.data.targetAddress.toLowerCase(),
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      d.aliases.unshift(rec);
      return rec;
    });
    return res.status(201).json({ alias });
  }
);

adminRouter.delete(
  '/api/aliases/:id',
  requireAuth,
  requireOrganisationMember,
  requirePermission('mailboxes.create'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    updateDb((d) => {
      d.aliases = d.aliases.filter((a) => !(a.id === req.params.id && a.organisationId === ctx.organisation!.id));
    });
    return res.json({ ok: true });
  }
);

adminRouter.post(
  '/api/groups',
  requireAuth,
  requireOrganisationMember,
  requirePermission('users.manage'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const schema = z.object({
      name: z.string().trim().min(2),
      emailAddress: z.string().trim().email(),
      description: z.string().trim().optional().default(''),
      members: z.array(z.string().email()).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide group name, valid email, and at least one member.' });

    const now = new Date().toISOString();
    const group = updateDb((d) => {
      const rec = {
        id: crypto.randomUUID(),
        organisationId: ctx.organisation!.id,
        name: parsed.data.name,
        emailAddress: parsed.data.emailAddress.toLowerCase(),
        description: parsed.data.description,
        members: parsed.data.members,
        createdAt: now,
        updatedAt: now,
      };
      d.distributionGroups.unshift(rec);
      return rec;
    });
    return res.status(201).json({ group });
  }
);

adminRouter.patch(
  '/api/groups/:id',
  requireAuth,
  requireOrganisationMember,
  requirePermission('users.manage'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    const schema = z.object({
      name: z.string().trim().min(2),
      emailAddress: z.string().trim().email(),
      description: z.string().trim().optional().default(''),
      members: z.array(z.string().email()).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide group name, valid email, and at least one member.' });

    const group = updateDb((d) => {
      const target = d.distributionGroups.find(
        (g) => g.id === req.params.id && g.organisationId === ctx.organisation!.id
      );
      if (!target) return null;
      target.name = parsed.data.name;
      target.emailAddress = parsed.data.emailAddress.toLowerCase();
      target.description = parsed.data.description;
      target.members = parsed.data.members;
      target.updatedAt = new Date().toISOString();
      return target;
    });
    if (!group) return res.status(404).json({ error: 'Distribution group not found.' });
    recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'GROUP_UPDATED', group.emailAddress, 'SUCCESS', 'ADMIN_ACTIVITY');
    return res.json({ group });
  }
);

adminRouter.delete(
  '/api/groups/:id',
  requireAuth,
  requireOrganisationMember,
  requirePermission('users.manage'),
  (req: AuthedRequest, res) => {
    const ctx = req.auth!;
    updateDb((d) => {
      d.distributionGroups = d.distributionGroups.filter(
        (g) => !(g.id === req.params.id && g.organisationId === ctx.organisation!.id)
      );
    });
    return res.json({ ok: true });
  }
);

// --- Admin Console Overview, Users, Roles, Security, Deliverability, Usage, Audit Logs, Billing ---

adminRouter.get('/api/admin/overview', requireAuth, requireOrganisationMember, requirePermission('usage.view'), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const orgId = ctx.organisation!.id;
  const mailboxes = db.mailboxes.filter((m) => m.organisationId === orgId);
  const domains = db.domains.filter((d) => d.organisationId === orgId);
  const totalUsedMb = Math.round(mailboxes.reduce((sum, m) => sum + m.usedMb, 0) * 10) / 10;
  const totalQuotaMb = ctx.organisation!.storageQuotaMb;
  const verifiedDomains = domains.filter(
    (d) => d.ownershipStatus === 'VERIFIED' && d.mxStatus === 'VERIFIED' && d.spfStatus === 'VERIFIED'
  ).length;
  const securityAlerts = db.securityEvents.filter(
    (s) => s.organisationId === orgId && s.severity !== 'INFO'
  ).length;

  const recentActivity = db.auditLogs
    .filter((a) => a.organisationId === orgId)
    .slice(0, 8);
  const recentSecurity = db.securityEvents
    .filter((s) => s.organisationId === orgId)
    .slice(0, 6);

  const mailboxGrowthSeries = [
    { month: 'Jun', mailboxes: Math.max(1, mailboxes.length - 3), storageGb: 8.2 },
    { month: 'Jul', mailboxes: Math.max(2, mailboxes.length - 2), storageGb: 10.6 },
    { month: 'Aug', mailboxes: Math.max(2, mailboxes.length - 1), storageGb: 13.4 },
    { month: 'Sep', mailboxes: mailboxes.length, storageGb: 15.1 },
    { month: 'Oct', mailboxes: mailboxes.length, storageGb: Math.round((totalUsedMb / 1024) * 10) / 10 },
  ];

  return res.json({
    kpis: {
      totalMailboxes: mailboxes.length,
      activeMailboxes: mailboxes.filter((m) => m.status === 'ACTIVE').length,
      connectedDomains: domains.length,
      verifiedDomains,
      totalUsedMb,
      totalQuotaMb,
      securityAlerts,
    },
    mailboxGrowthSeries,
    domains,
    recentActivity,
    recentSecurity,
  });
});

adminRouter.get('/api/admin/users', requireAuth, requireOrganisationMember, requirePermission('users.manage'), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const orgId = ctx.organisation!.id;
  const memberships = db.memberships.filter((m) => m.organisationId === orgId);
  const users = memberships.map((m) => {
    const u = db.users.find((x) => x.id === m.userId)!;
    const mb = db.mailboxes.find((x) => x.userId === u.id && x.organisationId === orgId) || null;
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      firstName: u.firstName,
      lastName: u.lastName,
      jobTitle: u.jobTitle,
      department: u.department,
      phone: u.phone,
      roleKey: m.roleKey,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      mailbox: mb,
    };
  });
  return res.json({ users });
});

adminRouter.patch('/api/admin/users/:userId', requireAuth, requireOrganisationMember, requirePermission('users.manage'), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const schema = z.object({
    roleKey: z.enum(['OWNER', 'ADMIN', 'MAILBOX_USER']).optional(),
    department: z.string().trim().max(80).optional(),
    jobTitle: z.string().trim().max(80).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid user update' });

  if (parsed.data.roleKey === 'OWNER' && ctx.membership?.roleKey !== 'OWNER') {
    return res.status(403).json({ error: 'Only an Organisation Owner can assign the Owner role.' });
  }

  const updated = updateDb((d) => {
    const mem = d.memberships.find((m) => m.userId === req.params.userId && m.organisationId === ctx.organisation!.id);
    const u = d.users.find((x) => x.id === req.params.userId);
    if (!mem || !u) return null;
    if (u.id === ctx.user.id && parsed.data.status === 'SUSPENDED') return 'SELF' as const;
    if (parsed.data.roleKey) {
      mem.roleKey = parsed.data.roleKey;
      const mb = d.mailboxes.find((m) => m.userId === u.id && m.organisationId === ctx.organisation!.id);
      if (mb) mb.roleKey = parsed.data.roleKey;
    }
    if (parsed.data.department !== undefined) u.department = parsed.data.department;
    if (parsed.data.jobTitle !== undefined) u.jobTitle = parsed.data.jobTitle;
    if (parsed.data.status) {
      u.status = parsed.data.status;
      mem.status = parsed.data.status;
      const mb = d.mailboxes.find((m) => m.userId === u.id && m.organisationId === ctx.organisation!.id);
      if (mb) mb.status = parsed.data.status;
      if (parsed.data.status === 'SUSPENDED') {
        d.sessions = d.sessions.filter((s) => s.userId !== u.id);
      }
    }
    u.updatedAt = new Date().toISOString();
    return { email: u.email, roleKey: mem.roleKey, status: u.status };
  });
  if (updated === 'SELF') return res.status(400).json({ error: 'You cannot suspend your own active account.' });
  if (!updated) return res.status(404).json({ error: 'User not found in your organisation.' });

  recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'USER_UPDATED', `${updated.email} (${updated.roleKey}, ${updated.status})`, 'SUCCESS', 'ADMIN_ACTIVITY');
  return res.json({ user: updated });
});

adminRouter.get('/api/admin/roles', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const overrides = db.roleOverrides[ctx.organisation!.id];
  const roles = DEFAULT_ROLES.map((r) => ({
    ...r,
    permissions: getPermissionsForRole(r.key, overrides),
  }));
  return res.json({ roles, allPermissions: ALL_PERMISSIONS });
});

adminRouter.patch('/api/admin/roles', requireAuth, requireOrganisationMember, requireOrgOwner, (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const schema = z.object({
    roleKey: z.enum(['ADMIN', 'MAILBOX_USER']),
    permissions: z.array(z.string()),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid role permission payload' });

  const validKeys = new Set(ALL_PERMISSIONS.map((p) => p.key));
  const cleaned = parsed.data.permissions.filter((p): p is PermissionKey => validKeys.has(p as PermissionKey));

  updateDb((d) => {
    if (!d.roleOverrides[ctx.organisation!.id]) {
      d.roleOverrides[ctx.organisation!.id] = {
        OWNER: getPermissionsForRole('OWNER'),
        ADMIN: getPermissionsForRole('ADMIN'),
        MAILBOX_USER: getPermissionsForRole('MAILBOX_USER'),
        PLATFORM_SUPER_ADMIN: [],
      };
    }
    d.roleOverrides[ctx.organisation!.id][parsed.data.roleKey] = cleaned;
  });

  recordAudit(req, ctx.organisation!.id, ctx.user.id, ctx.user.email, 'ROLE_PERMISSIONS_UPDATED', parsed.data.roleKey, 'SUCCESS', 'COMPLIANCE_AUDIT');
  return res.json({ ok: true });
});

adminRouter.get('/api/admin/security', requireAuth, requireOrganisationMember, requirePermission('usage.view'), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const orgId = ctx.organisation!.id;
  const events = db.securityEvents.filter((s) => s.organisationId === orgId);
  const settings = db.organisationSettings.find((s) => s.organisationId === orgId);

  return res.json({
    summary: {
      failedLogins: events.filter((e) => e.eventType === 'LOGIN_FAILED').length,
      blockedSpam: events.filter((e) => e.eventType === 'SPAM_BLOCKED').length,
      malwareAlerts: events.filter((e) => e.eventType === 'MALWARE_QUARANTINED').length,
      rateLimitTriggers: events.filter((e) => e.eventType === 'RATE_LIMIT_TRIGGERED').length,
    },
    events,
    settings,
  });
});

adminRouter.get('/api/admin/deliverability', requireAuth, requireOrganisationMember, requirePermission('usage.view'), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const orgId = ctx.organisation!.id;
  const events = db.deliveryEvents.filter((e) => e.organisationId === orgId);
  const domains = db.domains.filter((d) => d.organisationId === orgId);

  return res.json({
    metrics: {
      outboundVolume: events.length + 142,
      accepted: events.filter((e) => e.status === 'ACCEPTED' || e.status === 'SENT_TO_RECEIVING_SERVER').length + 136,
      bounced: events.filter((e) => e.status === 'BOUNCED').length,
      deferred: events.filter((e) => e.status === 'DEFERRED').length,
      queueSize: events.filter((e) => e.status === 'QUEUED' || e.status === 'DEFERRED').length,
      spamComplaints: 0,
    },
    trends: [
      { day: 'Mon', accepted: 34, bounced: 0, deferred: 1 },
      { day: 'Tue', accepted: 41, bounced: 1, deferred: 0 },
      { day: 'Wed', accepted: 29, bounced: 0, deferred: 1 },
      { day: 'Thu', accepted: 38, bounced: 0, deferred: 0 },
      { day: 'Fri', accepted: events.length + 18, bounced: events.filter((e) => e.status === 'BOUNCED').length, deferred: events.filter((e) => e.status === 'DEFERRED').length },
    ],
    domains,
    queue: events,
  });
});

adminRouter.get('/api/admin/usage', requireAuth, requireOrganisationMember, requirePermission('usage.view'), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const mailboxes = db.mailboxes.filter((m) => m.organisationId === ctx.organisation!.id);
  const usedMb = Math.round(mailboxes.reduce((acc, m) => acc + m.usedMb, 0) * 10) / 10;
  const allocatedMb = ctx.organisation!.storageQuotaMb;

  const storageTrends = [
    { month: 'Jun', usedGb: Math.max(0.4, Math.round((usedMb / 1024) * 0.55 * 100) / 100), quotaGb: Math.round((allocatedMb / 1024) * 10) / 10 },
    { month: 'Jul', usedGb: Math.max(0.6, Math.round((usedMb / 1024) * 0.68 * 100) / 100), quotaGb: Math.round((allocatedMb / 1024) * 10) / 10 },
    { month: 'Aug', usedGb: Math.max(0.8, Math.round((usedMb / 1024) * 0.8 * 100) / 100), quotaGb: Math.round((allocatedMb / 1024) * 10) / 10 },
    { month: 'Sep', usedGb: Math.max(0.9, Math.round((usedMb / 1024) * 0.92 * 100) / 100), quotaGb: Math.round((allocatedMb / 1024) * 10) / 10 },
    { month: 'Oct', usedGb: Math.round((usedMb / 1024) * 100) / 100, quotaGb: Math.round((allocatedMb / 1024) * 10) / 10 },
  ];

  return res.json({
    allocatedMb,
    usedMb,
    availableMb: Math.max(0, Math.round((allocatedMb - usedMb) * 10) / 10),
    storageTrends,
    mailboxes: mailboxes.map((m) => ({
      id: m.id,
      emailAddress: m.emailAddress,
      displayName: m.displayName,
      quotaMb: m.quotaMb,
      usedMb: m.usedMb,
      percentUsed: Math.min(100, Math.round((m.usedMb / m.quotaMb) * 1000) / 10),
      status: m.status,
    })),
  });
});

adminRouter.get('/api/admin/audit-logs', requireAuth, requireOrganisationMember, requirePermission('audit.view'), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const category = typeof req.query.category === 'string' ? req.query.category : 'ALL';
  let logs = db.auditLogs.filter((a) => a.organisationId === ctx.organisation!.id);
  if (category !== 'ALL') {
    logs = logs.filter((a) => a.category === category);
  }
  return res.json({ logs });
});

adminRouter.get('/api/admin/billing', requireAuth, requireOrganisationMember, requirePermission('usage.view'), (req: AuthedRequest, res) => {
  const ctx = req.auth!;
  const db = getDb();
  const mailboxCount = db.mailboxes.filter((m) => m.organisationId === ctx.organisation!.id).length;
  const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  return res.json({
    billingMode: razorpayConfigured ? 'LIVE' : 'UNAVAILABLE_SANDBOX',
    currentPlan: {
      code: 'BUSINESS_ILLUSTRATIVE',
      name: 'Business Mail (Illustrative)',
      pricePerSeatInr: 299,
      seatsAllocated: Math.max(mailboxCount, 10),
      seatsUsed: mailboxCount,
      status: 'ILLUSTRATIVE_SANDBOX',
      renewalDate: new Date(Date.now() + 22 * 86400_000).toISOString(),
    },
    plans: [
      { code: 'STARTER', name: 'Starter', priceInr: 149, quotaPerMailboxGb: 10, description: 'Custom domain email for small teams' },
      { code: 'BUSINESS', name: 'Business', priceInr: 299, quotaPerMailboxGb: 30, description: 'Shared mailboxes, aliases, and delivery analytics' },
      { code: 'ENTERPRISE', name: 'Enterprise', priceInr: 549, quotaPerMailboxGb: 100, description: 'Compliance audit logs, advanced retention, and priority support' },
    ],
    invoices: [
      { invoiceNumber: 'INV-CORIVO-2026-10', issuedAt: new Date(Date.now() - 8 * 86400_000).toISOString(), amountInr: 2990, gstInr: 538, status: 'ILLUSTRATIVE' },
    ],
  });
});
