import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { draftSchema, sanitizeHtml, sendMailSchema } from '../../shared/validation.ts';
import { ATTACHMENTS_DIR, getDb, updateDb } from '../db/store.ts';
import type { CorivoDatabase } from '../db/seed.ts';
import { type AuthedRequest, requireAuth, requireOrganisationMember } from '../middleware/auth.ts';
import {
  emailSearchProvider,
  mailTransportProvider,
  spamProtectionProvider,
} from '../providers/index.ts';

export const mailRouter = Router();

const DEFAULT_MAX_ATTACHMENT_MB = 25;
const SYSTEM_MOVE_FOLDERS = new Set(['inbox', 'sent', 'drafts', 'archive', 'spam', 'trash', 'snoozed']);
const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'text/',
  'image/',
  'application/vnd.openxmlformats-officedocument',
  'application/msword',
  'application/vnd.ms-excel',
  'application/zip',
  'application/json',
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeHeaderFilename(name: string): string {
  return name.replace(/["\\\r\n;]/g, '_').slice(0, 180) || 'attachment';
}

function purgeOrphanedAttachments(d: CorivoDatabase, candidateIds: string[]): void {
  if (candidateIds.length === 0) return;
  const referencedIds = new Set<string>();
  for (const m of d.messages) {
    for (const a of m.attachments) referencedIds.add(a.id);
  }
  for (const dr of d.drafts) {
    for (const id of dr.attachmentIds) referencedIds.add(id);
  }
  const toRemove = d.attachments.filter((a) => candidateIds.includes(a.id) && !referencedIds.has(a.id));
  if (toRemove.length === 0) return;
  const removeSet = new Set(toRemove.map((a) => a.id));
  d.attachments = d.attachments.filter((a) => !removeSet.has(a.id));
  for (const att of toRemove) {
    if (!att.storageKey.startsWith('seed/')) {
      const fullPath = path.join(ATTACHMENTS_DIR, path.basename(att.storageKey));
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // Best-effort cleanup
        }
      }
    }
  }
}

function recalculateMailboxUsedMb(d: CorivoDatabase, mailboxId: string): void {
  const mb = d.mailboxes.find((m) => m.id === mailboxId);
  if (!mb) return;
  const msgBytes = d.messages.filter((m) => m.mailboxId === mailboxId).reduce((acc, m) => acc + m.sizeBytes, 0);
  mb.usedMb = Math.round((msgBytes / (1024 * 1024)) * 100) / 100;
}

function getMailboxForUser(req: AuthedRequest) {
  const ctx = req.auth!;
  if (!ctx.mailbox || !ctx.organisation) {
    return null;
  }
  return { mailbox: ctx.mailbox, org: ctx.organisation, user: ctx.user };
}

// List folders + unread counts for the active mailbox
mailRouter.get('/api/folders', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) {
    return res.json({ folders: [], unreadCounts: {}, customFolders: [] });
  }

  const db = getDb();
  const mailboxFolders = db.folders.filter((f) => f.mailboxId === info.mailbox.id);
  const mailboxMessages = db.messages.filter(
    (m) => m.mailboxId === info.mailbox.id && m.organisationId === info.org.id
  );

  const unreadCounts: Record<string, number> = {
    inbox: mailboxMessages.filter((m) => m.folderSlug === 'inbox' && !m.isRead).length,
    starred: mailboxMessages.filter((m) => m.isStarred && m.folderSlug !== 'trash' && !m.isRead).length,
    snoozed: mailboxMessages.filter((m) => m.folderSlug === 'snoozed').length,
    sent: 0,
    drafts: db.drafts.filter((d) => d.mailboxId === info.mailbox.id).length,
    spam: mailboxMessages.filter((m) => m.folderSlug === 'spam' && !m.isRead).length,
    trash: mailboxMessages.filter((m) => m.folderSlug === 'trash').length,
  };

  for (const f of mailboxFolders) {
    if (!f.isSystem) {
      unreadCounts[f.slug] = mailboxMessages.filter((m) => m.folderSlug === f.slug && !m.isRead).length;
    }
  }

  return res.json({
    folders: mailboxFolders,
    customFolders: mailboxFolders.filter((f) => !f.isSystem),
    unreadCounts,
  });
});

mailRouter.post('/api/folders', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox provisioned for this account.' });

  const schema = z.object({ name: z.string().trim().min(1, 'Folder name is required').max(40) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid folder name' });

  const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `folder-${Date.now()}`;
  const db = getDb();
  if (db.folders.some((f) => f.mailboxId === info.mailbox.id && f.slug === slug)) {
    return res.status(409).json({ error: 'A folder with this name already exists.' });
  }

  const now = new Date().toISOString();
  const folder = updateDb((d) => {
    const created = {
      id: crypto.randomUUID(),
      mailboxId: info.mailbox.id,
      name: parsed.data.name,
      slug,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    d.folders.push(created);
    return created;
  });
  return res.status(201).json({ folder });
});

mailRouter.patch('/api/folders/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox.' });

  const schema = z.object({ name: z.string().trim().min(1).max(40) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid folder name' });

  const folder = updateDb((d) => {
    const f = d.folders.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && !x.isSystem);
    if (!f) return null;
    f.name = parsed.data.name;
    f.updatedAt = new Date().toISOString();
    return f;
  });
  if (!folder) return res.status(404).json({ error: 'Custom folder not found.' });
  return res.json({ folder });
});

mailRouter.delete('/api/folders/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox.' });

  const ok = updateDb((d) => {
    const f = d.folders.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && !x.isSystem);
    if (!f) return false;
    d.messages
      .filter((m) => m.mailboxId === info.mailbox.id && m.folderSlug === f.slug)
      .forEach((m) => {
        m.folderSlug = 'inbox';
      });
    d.folders = d.folders.filter((x) => x.id !== f.id);
    return true;
  });
  if (!ok) return res.status(404).json({ error: 'Custom folder not found.' });
  return res.json({ ok: true });
});

// List messages with folder, search, filtering, sorting, pagination
mailRouter.get('/api/mail', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) {
    return res.json({ messages: [], total: 0, page: 1, pageSize: 25, hasMailbox: false });
  }

  const folder = String(req.query.folder || 'inbox');
  const query = typeof req.query.q === 'string' ? req.query.q : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const subject = typeof req.query.subject === 'string' ? req.query.subject : undefined;
  const filter = String(req.query.filter || 'all'); // all | unread | starred | attachments
  const sort = String(req.query.sort || 'newest'); // newest | oldest
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize || 25)));

  const db = getDb();
  let items = db.messages.filter(
    (m) => m.mailboxId === info.mailbox.id && m.organisationId === info.org.id
  );

  if (folder === 'starred') {
    items = items.filter((m) => m.isStarred && m.folderSlug !== 'trash');
  } else if (folder === 'all') {
    items = items.filter((m) => m.folderSlug !== 'trash' && m.folderSlug !== 'spam');
  } else {
    items = items.filter((m) => m.folderSlug === folder);
  }

  if (filter === 'unread') items = items.filter((m) => !m.isRead);
  if (filter === 'starred') items = items.filter((m) => m.isStarred);
  if (filter === 'attachments') items = items.filter((m) => m.attachments.length > 0);

  if (query || from || to || subject || req.query.hasAttachment === 'true' || req.query.dateFrom || req.query.dateTo) {
    items = emailSearchProvider.search(items, {
      query,
      from,
      to,
      subject,
      hasAttachment: req.query.hasAttachment === 'true',
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
    });
  }

  items.sort((a, b) => {
    const diff = new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
    return sort === 'oldest' ? -diff : diff;
  });

  const total = items.length;
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return res.json({
    hasMailbox: true,
    mailboxAddress: info.mailbox.emailAddress,
    messages: paged,
    total,
    page,
    pageSize,
  });
});

// Drafts list & CRUD (placed before /api/mail/:id!)
mailRouter.get('/api/mail/drafts', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.json({ drafts: [] });
  const db = getDb();
  const drafts = db.drafts
    .filter((d) => d.mailboxId === info.mailbox.id && d.organisationId === info.org.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return res.json({ drafts });
});

mailRouter.post('/api/mail/drafts', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox provisioned.' });
  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid draft payload' });

  const now = new Date().toISOString();
  const safeBodyHtml = sanitizeHtml(parsed.data.bodyHtml);
  const draft = updateDb((d) => {
    const created = {
      id: crypto.randomUUID(),
      organisationId: info.org.id,
      mailboxId: info.mailbox.id,
      toAddresses: parsed.data.to,
      ccAddresses: parsed.data.cc,
      bccAddresses: parsed.data.bcc,
      subject: parsed.data.subject,
      bodyHtml: safeBodyHtml,
      attachmentIds: parsed.data.attachmentIds,
      createdAt: now,
      updatedAt: now,
    };
    d.drafts.unshift(created);
    return created;
  });
  return res.status(201).json({ draft });
});

mailRouter.patch('/api/mail/drafts/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox provisioned.' });
  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid draft payload' });

  const safeBodyHtml = sanitizeHtml(parsed.data.bodyHtml);
  const draft = updateDb((d) => {
    const existing = d.drafts.find(
      (x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id
    );
    if (!existing) return null;
    existing.toAddresses = parsed.data.to;
    existing.ccAddresses = parsed.data.cc;
    existing.bccAddresses = parsed.data.bcc;
    existing.subject = parsed.data.subject;
    existing.bodyHtml = safeBodyHtml;
    existing.attachmentIds = parsed.data.attachmentIds;
    existing.updatedAt = new Date().toISOString();
    return existing;
  });
  if (!draft) return res.status(404).json({ error: 'Draft not found.' });
  return res.json({ draft });
});

mailRouter.delete('/api/mail/drafts/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox.' });
  updateDb((d) => {
    const target = d.drafts.find(
      (x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id
    );
    d.drafts = d.drafts.filter(
      (x) => !(x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id)
    );
    if (target) purgeOrphanedAttachments(d, target.attachmentIds);
  });
  return res.json({ ok: true });
});

// Empty trash
mailRouter.post('/api/mail/trash/empty', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox.' });
  const deletedCount = updateDb((d) => {
    const trashMessages = d.messages.filter(
      (m) => m.mailboxId === info.mailbox.id && m.organisationId === info.org.id && m.folderSlug === 'trash'
    );
    const attIds = trashMessages.flatMap((m) => m.attachments.map((a) => a.id));
    d.messages = d.messages.filter(
      (m) => !(m.mailboxId === info.mailbox.id && m.organisationId === info.org.id && m.folderSlug === 'trash')
    );
    purgeOrphanedAttachments(d, attIds);
    recalculateMailboxUsedMb(d, info.mailbox.id);
    return trashMessages.length;
  });
  return res.json({ deletedCount });
});

async function sendOutboundEmail(
  info: NonNullable<ReturnType<typeof getMailboxForUser>>,
  payload: z.infer<typeof sendMailSchema>
) {
  const totalRecipients = payload.to.length + payload.cc.length + payload.bcc.length;
  if (totalRecipients > 50) {
    return { ok: false as const, status: 400, body: { error: 'Maximum 50 recipients permitted per outbound message.' } };
  }

  const sanitizedBodyHtml = sanitizeHtml(payload.bodyHtml);
  const db = getDb();
  const attachedRecords = db.attachments.filter(
    (a) =>
      payload.attachmentIds.includes(a.id) &&
      a.organisationId === info.org.id &&
      a.mailboxId === info.mailbox.id
  );

  const totalBytes = Buffer.byteLength(sanitizedBodyHtml, 'utf8') + attachedRecords.reduce((acc, a) => acc + a.sizeBytes, 0);
  const addedMb = totalBytes / (1024 * 1024);
  if (info.mailbox.usedMb + addedMb > info.mailbox.quotaMb) {
    return { ok: false as const, status: 400, body: { error: 'Mailbox storage quota exceeded. Free up space before sending.' } };
  }

  const scanResult = await spamProtectionProvider.scanOutboundOrInbound({
    subject: payload.subject,
    bodyHtml: sanitizedBodyHtml,
    attachments: attachedRecords.map((a) => ({
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
  });

  if (scanResult.scanStatus === 'QUARANTINED') {
    return { ok: false as const, status: 400, body: { error: scanResult.detail } };
  }

  const senderDomain = info.mailbox.emailAddress.split('@')[1] || info.org.primaryDomain || 'corivotech.example';
  const transportResult = await mailTransportProvider.submitMessage({
    from: info.mailbox.emailAddress,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: payload.subject,
    bodyHtml: sanitizedBodyHtml,
    senderDomain,
  });

  const now = new Date().toISOString();
  const snippet = stripHtml(sanitizedBodyHtml).slice(0, 140);

  const sentMessage = updateDb((d) => {
    const newMsgId = crypto.randomUUID();
    const msgAttachments = attachedRecords.map((a) => ({ ...a, messageId: newMsgId }));
    const replyTarget = payload.inReplyToId
      ? d.messages.find(
          (m) =>
            m.id === payload.inReplyToId &&
            m.mailboxId === info.mailbox.id &&
            m.organisationId === info.org.id
        )
      : undefined;

    const msg = {
      id: newMsgId,
      organisationId: info.org.id,
      mailboxId: info.mailbox.id,
      folderSlug: 'sent',
      threadId: replyTarget?.threadId || crypto.randomUUID(),
      externalStoreId: `dovecot://${senderDomain}/${info.mailbox.username}/${transportResult.messageRef}`,
      fromName: info.user.displayName,
      fromAddress: info.mailbox.emailAddress,
      toAddresses: payload.to,
      ccAddresses: payload.cc,
      bccAddresses: payload.bcc,
      subject: payload.subject,
      snippet,
      bodyHtml: sanitizedBodyHtml,
      isRead: true,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: transportResult.status,
      spamScore: scanResult.spamScore,
      sizeBytes: totalBytes,
      attachments: msgAttachments,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
    };
    d.messages.unshift(msg);

    for (const rcpt of [...payload.to, ...payload.cc, ...payload.bcc]) {
      const targetMb = d.mailboxes.find((mb) => mb.emailAddress.toLowerCase() === rcpt.toLowerCase() && mb.status === 'ACTIVE');
      if (targetMb && targetMb.id !== info.mailbox.id) {
        d.messages.unshift({
          ...msg,
          id: crypto.randomUUID(),
          organisationId: targetMb.organisationId,
          mailboxId: targetMb.id,
          folderSlug: scanResult.isSpam ? 'spam' : 'inbox',
          isRead: false,
          deliveryStatus: 'RECEIVED',
        });
      }
    }

    const recipientDomain = (payload.to[0] || '').split('@')[1] || 'unknown.example';
    d.deliveryEvents.unshift({
      id: crypto.randomUUID(),
      organisationId: info.org.id,
      messageRef: transportResult.messageRef,
      senderDomain,
      recipientDomain,
      status: transportResult.status,
      retryCount: 0,
      failureReason: transportResult.accepted ? null : transportResult.detail,
      createdAt: now,
    });

    const mb = d.mailboxes.find((m) => m.id === info.mailbox.id);
    if (mb) {
      mb.usedMb = Math.round((mb.usedMb + totalBytes / (1024 * 1024)) * 100) / 100;
      mb.lastActivityAt = now;
    }

    if (payload.draftId) {
      d.drafts = d.drafts.filter((dr) => !(dr.id === payload.draftId && dr.mailboxId === info.mailbox.id));
    }

    return msg;
  });

  if (!transportResult.accepted) {
    return {
      ok: false as const,
      status: 502,
      body: {
        error: transportResult.detail,
        message: sentMessage,
        transport: transportResult,
      },
    };
  }

  return {
    ok: true as const,
    status: 201,
    body: {
      message: sentMessage,
      transport: transportResult,
    },
  };
}

// Send email (validates recipients, scans attachments, submits to MailTransportProvider)
mailRouter.post('/api/mail/send', requireAuth, requireOrganisationMember, async (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox provisioned for this account.' });
  if (info.mailbox.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Your mailbox is currently suspended and cannot send email.' });
  }

  const parsed = sendMailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid email fields' });
  }

  const result = await sendOutboundEmail(info, parsed.data);
  return res.status(result.status).json(result.body);
});

mailRouter.post('/api/mail/:id/reply', requireAuth, requireOrganisationMember, async (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox provisioned.' });
  if (info.mailbox.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Your mailbox is currently suspended and cannot send email.' });
  }

  const db = getDb();
  const original = db.messages.find(
    (m) => m.id === req.params.id && m.mailboxId === info.mailbox.id && m.organisationId === info.org.id
  );
  if (!original) return res.status(404).json({ error: 'Original message not found.' });

  const schema = z.object({
    bodyHtml: z.string().min(1, 'Reply body cannot be empty'),
    replyAll: z.boolean().optional().default(false),
    attachmentIds: z.array(z.string()).optional().default([]),
    to: z.array(z.string().trim().email()).optional(),
    cc: z.array(z.string().trim().email()).optional(),
    subject: z.string().trim().min(1).max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reply payload' });
  }

  const defaultTo = parsed.data.to && parsed.data.to.length > 0 ? parsed.data.to : [original.fromAddress];
  const defaultCc =
    parsed.data.cc ??
    (parsed.data.replyAll
      ? [...original.toAddresses, ...original.ccAddresses].filter(
          (addr) => addr.toLowerCase() !== info.mailbox.emailAddress.toLowerCase() && !defaultTo.includes(addr)
        )
      : []);
  const subject = parsed.data.subject || (original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`);

  const result = await sendOutboundEmail(info, {
    to: defaultTo,
    cc: defaultCc,
    bcc: [],
    subject,
    bodyHtml: parsed.data.bodyHtml,
    attachmentIds: parsed.data.attachmentIds,
    inReplyToId: original.id,
  });
  return res.status(result.status).json(result.body);
});

mailRouter.post('/api/mail/:id/forward', requireAuth, requireOrganisationMember, async (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox provisioned.' });
  if (info.mailbox.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Your mailbox is currently suspended and cannot send email.' });
  }

  const db = getDb();
  const original = db.messages.find(
    (m) => m.id === req.params.id && m.mailboxId === info.mailbox.id && m.organisationId === info.org.id
  );
  if (!original) return res.status(404).json({ error: 'Original message not found.' });

  const schema = z.object({
    to: z.array(z.string().trim().email('Invalid recipient email')).min(1, 'At least one forward recipient is required'),
    cc: z.array(z.string().trim().email()).optional().default([]),
    bcc: z.array(z.string().trim().email()).optional().default([]),
    bodyHtml: z.string().min(1, 'Message body cannot be empty'),
    subject: z.string().trim().min(1).max(300).optional(),
    attachmentIds: z.array(z.string()).optional().default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid forward payload' });
  }

  const subject = parsed.data.subject || (original.subject.startsWith('Fwd:') ? original.subject : `Fwd: ${original.subject}`);
  const result = await sendOutboundEmail(info, {
    to: parsed.data.to,
    cc: parsed.data.cc,
    bcc: parsed.data.bcc,
    subject,
    bodyHtml: parsed.data.bodyHtml,
    attachmentIds: parsed.data.attachmentIds,
  });
  return res.status(result.status).json(result.body);
});

// Single message & thread view
mailRouter.get('/api/mail/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(404).json({ error: 'Mailbox not found.' });

  const db = getDb();
  const message = db.messages.find(
    (m) => m.id === req.params.id && m.mailboxId === info.mailbox.id && m.organisationId === info.org.id
  );
  if (!message) {
    return res.status(404).json({ error: 'Message not found in your mailbox.' });
  }

  const threadMessages = db.messages
    .filter(
      (m) =>
        m.threadId === message.threadId &&
        m.mailboxId === info.mailbox.id &&
        m.organisationId === info.org.id
    )
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  return res.json({ message, thread: threadMessages });
});

// Message actions
mailRouter.post('/api/mail/:id/read', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No mailbox' });
  const isRead = typeof req.body?.isRead === 'boolean' ? req.body.isRead : true;
  const updated = updateDb((d) => {
    const m = d.messages.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id);
    if (!m) return null;
    m.isRead = isRead;
    m.updatedAt = new Date().toISOString();
    return m;
  });
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  return res.json({ message: updated });
});

mailRouter.post('/api/mail/:id/star', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No mailbox' });
  const updated = updateDb((d) => {
    const m = d.messages.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id);
    if (!m) return null;
    m.isStarred = typeof req.body?.isStarred === 'boolean' ? req.body.isStarred : !m.isStarred;
    m.updatedAt = new Date().toISOString();
    return m;
  });
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  return res.json({ message: updated });
});

mailRouter.post('/api/mail/:id/archive', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No mailbox' });
  const updated = updateDb((d) => {
    const m = d.messages.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id);
    if (!m) return null;
    m.folderSlug = 'archive';
    m.updatedAt = new Date().toISOString();
    return m;
  });
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  return res.json({ message: updated });
});

mailRouter.post('/api/mail/:id/move', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No mailbox' });
  const folderSlug = String(req.body?.folderSlug || '').trim();
  const db = getDb();
  const customSlugs = new Set(db.folders.filter((f) => f.mailboxId === info.mailbox.id).map((f) => f.slug));
  if (!folderSlug || (!SYSTEM_MOVE_FOLDERS.has(folderSlug) && !customSlugs.has(folderSlug))) {
    return res.status(400).json({ error: 'Invalid target folder.' });
  }
  const updated = updateDb((d) => {
    const m = d.messages.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id);
    if (!m) return null;
    m.folderSlug = folderSlug;
    if (folderSlug !== 'snoozed') m.snoozedUntil = null;
    m.updatedAt = new Date().toISOString();
    return m;
  });
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  return res.json({ message: updated });
});

mailRouter.post('/api/mail/:id/snooze', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No mailbox' });
  const rawDate = req.body?.snoozedUntil ? String(req.body.snoozedUntil) : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const parsedTime = Date.parse(rawDate);
  if (Number.isNaN(parsedTime) || parsedTime <= Date.now()) {
    return res.status(400).json({ error: 'Snooze time must be a valid future timestamp.' });
  }
  const snoozedUntil = new Date(parsedTime).toISOString();
  const updated = updateDb((d) => {
    const m = d.messages.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id);
    if (!m) return null;
    m.folderSlug = 'snoozed';
    m.snoozedUntil = snoozedUntil;
    m.updatedAt = new Date().toISOString();
    return m;
  });
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  return res.json({ message: updated, mode: 'DEVELOPMENT_SIMULATED' });
});

mailRouter.post('/api/mail/:id/unsnooze', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No mailbox' });
  const updated = updateDb((d) => {
    const m = d.messages.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id);
    if (!m) return null;
    m.folderSlug = 'inbox';
    m.snoozedUntil = null;
    m.updatedAt = new Date().toISOString();
    return m;
  });
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  return res.json({ message: updated });
});

mailRouter.delete('/api/mail/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No mailbox' });
  const permanent = req.query.permanent === 'true';
  const result = updateDb((d) => {
    const m = d.messages.find((x) => x.id === req.params.id && x.mailboxId === info.mailbox.id && x.organisationId === info.org.id);
    if (!m) return null;
    if (permanent || m.folderSlug === 'trash') {
      const attIds = m.attachments.map((a) => a.id);
      d.messages = d.messages.filter((x) => x.id !== m.id);
      purgeOrphanedAttachments(d, attIds);
      recalculateMailboxUsedMb(d, info.mailbox.id);
      return { deleted: true };
    }
    m.folderSlug = 'trash';
    m.updatedAt = new Date().toISOString();
    return { message: m };
  });
  if (!result) return res.status(404).json({ error: 'Message not found' });
  return res.json(result);
});

// Attachments upload (Base64 JSON payload validated up to configured MB limit and stored privately)
mailRouter.post('/api/attachments/upload', requireAuth, requireOrganisationMember, async (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(400).json({ error: 'No active mailbox.' });

  const schema = z.object({
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.string().trim().min(1).max(120),
    contentBase64: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid attachment payload' });

  const normalizedMime = parsed.data.mimeType.toLowerCase();
  const mimeAllowed = ALLOWED_MIME_PREFIXES.some((prefix) => normalizedMime.startsWith(prefix));
  if (!mimeAllowed) {
    return res.status(400).json({ error: `File type ${parsed.data.mimeType} is blocked by security policy.` });
  }

  const cleanBase64 = parsed.data.contentBase64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)) {
    return res.status(400).json({ error: 'Attachment payload is not valid base64 data.' });
  }

  const db = getDb();
  const maxMb = Math.min(50, Math.max(1, db.platformSettings.maxAttachmentMb || DEFAULT_MAX_ATTACHMENT_MB));
  const maxBytes = maxMb * 1024 * 1024;

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.byteLength === 0) {
    return res.status(400).json({ error: 'Attachment file cannot be empty.' });
  }
  if (buffer.byteLength > maxBytes) {
    return res.status(413).json({ error: `Attachment exceeds the ${maxMb} MB maximum file size limit.` });
  }
  if (info.mailbox.usedMb + buffer.byteLength / (1024 * 1024) > info.mailbox.quotaMb) {
    return res.status(413).json({ error: 'Mailbox storage quota exceeded. Free up space before uploading attachments.' });
  }

  const scan = await spamProtectionProvider.scanOutboundOrInbound({
    subject: '',
    bodyHtml: '',
    attachments: [{ fileName: parsed.data.fileName, mimeType: parsed.data.mimeType, sizeBytes: buffer.byteLength }],
  });

  if (scan.scanStatus === 'QUARANTINED') {
    return res.status(400).json({ error: scan.detail });
  }

  const attId = crypto.randomUUID();
  const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `${info.org.id}/${attId}-${safeName}`;
  const fullPath = path.join(ATTACHMENTS_DIR, `${attId}-${safeName}`);
  fs.writeFileSync(fullPath, buffer);

  const attachment = updateDb((d) => {
    const rec = {
      id: attId,
      organisationId: info.org.id,
      mailboxId: info.mailbox.id,
      messageId: null,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: buffer.byteLength,
      storageKey,
      scanStatus: 'CLEAN' as const,
      createdAt: new Date().toISOString(),
    };
    d.attachments.push(rec);
    return rec;
  });

  return res.status(201).json({ attachment });
});

// Authorised private attachment download (mailbox-scoped ownership verification)
mailRouter.get('/api/attachments/:id/download', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const info = getMailboxForUser(req);
  if (!info) return res.status(403).json({ error: 'Forbidden' });

  const db = getDb();
  const att = db.attachments.find((a) => a.id === req.params.id && a.organisationId === info.org.id);
  if (!att) {
    return res.status(404).json({ error: 'Attachment not found or access denied.' });
  }

  const hasMailboxAccess =
    att.mailboxId === info.mailbox.id ||
    db.messages.some(
      (m) =>
        m.mailboxId === info.mailbox.id &&
        m.organisationId === info.org.id &&
        m.attachments.some((ma) => ma.id === att.id)
    );

  if (!hasMailboxAccess) {
    return res.status(404).json({ error: 'Attachment not found or access denied.' });
  }

  const safeHeaderName = sanitizeHeaderFilename(att.fileName);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename="${safeHeaderName}"`);

  // If stored on disk, stream file; if seed attachment, generate illustrative clean document bytes
  if (!att.storageKey.startsWith('seed/')) {
    const fileNamePart = path.basename(att.storageKey);
    const fullPath = path.join(ATTACHMENTS_DIR, fileNamePart);
    if (fs.existsSync(fullPath)) {
      const safeMime = att.mimeType.toLowerCase().includes('html') || att.mimeType.toLowerCase().includes('svg')
        ? 'application/octet-stream'
        : att.mimeType;
      res.setHeader('Content-Type', safeMime);
      return fs.createReadStream(fullPath).pipe(res);
    }
  }

  const fallbackBody = `Corivo Mail — Authorised Attachment Download\nFile: ${att.fileName}\nMIME: ${att.mimeType}\nOrganisation: ${info.org.name}\nScan Status: ${att.scanStatus}\n\n(Development sample attachment artifact.)\n`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.send(fallbackBody);
});
