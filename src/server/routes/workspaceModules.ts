import crypto from 'node:crypto';
import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import {
  calendarEventSchema,
  contactSchema,
} from '../../shared/validation.ts';
import { getDb, updateDb } from '../db/store.ts';
import { type AuthedRequest, recordAudit, requireAuth, requireOrganisationMember } from '../middleware/auth.ts';
import { accountRouter } from './account.ts';

export const workspaceModulesRouter = Router();

// Account, notification and onboarding endpoints live in their own module but are
// mounted here as well so a consumer that only mounts the workspace router still
// gets the complete authenticated workspace API.
workspaceModulesRouter.use(accountRouter);

function orgId(req: AuthedRequest): string | null {
  return req.auth?.organisation?.id || null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: message });
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

workspaceModulesRouter.get('/api/contacts', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const db = getDb();
  const org = orgId(req)!;
  let contacts = db.contacts.filter((c) => c.organisationId === org);
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const group = typeof req.query.group === 'string' ? req.query.group.trim().toLowerCase() : '';
  if (search) {
    contacts = contacts.filter((c) => `${c.fullName} ${c.email} ${c.company} ${c.phone}`.toLowerCase().includes(search));
  }
  if (group && group !== 'all') {
    contacts = contacts.filter((c) => c.groupName.toLowerCase() === group);
  }
  const groups = Array.from(new Set(contacts.map((c) => c.groupName).filter(Boolean))).sort();
  return res.json({ contacts, groups });
});

workspaceModulesRouter.post('/api/contacts', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Invalid contact.');
  const contact = { ...parsed.data, id: crypto.randomUUID(), organisationId: orgId(req)!, userId: req.auth!.user.id, createdAt: nowIso(), updatedAt: nowIso() };
  updateDb((db) => db.contacts.push(contact));
  return res.status(201).json({ contact });
});

workspaceModulesRouter.patch('/api/contacts/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Invalid contact.');
  let found = false;
  updateDb((db) => {
    const contact = db.contacts.find((c) => c.id === req.params.id && c.organisationId === orgId(req));
    if (!contact) return;
    found = true;
    Object.assign(contact, parsed.data, { updatedAt: nowIso() });
  });
  if (!found) return res.status(404).json({ error: 'Contact not found.' });
  return res.json({ contact: getDb().contacts.find((c) => c.id === req.params.id) });
});

workspaceModulesRouter.delete('/api/contacts/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let found = false;
  updateDb((db) => {
    const before = db.contacts.length;
    db.contacts = db.contacts.filter((c) => !(c.id === req.params.id && c.organisationId === orgId(req)));
    found = db.contacts.length < before;
  });
  if (!found) return res.status(404).json({ error: 'Contact not found.' });
  return res.json({ ok: true });
});

workspaceModulesRouter.post('/api/contacts/import', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const content: string = typeof req.body?.content === 'string' ? req.body.content : '';
  if (!content.trim()) return badRequest(res, 'Provide CSV content to import.');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.slice(1).map(parseCsvLine).filter((cells) => cells.some(Boolean));
  const org = orgId(req)!;
  const userId = req.auth!.user.id;
  const timestamp = nowIso();
  const groupNames = new Set<string>();
  updateDb((db) => {
    for (const cells of rows) {
      const [fullName = '', email = '', phone = '', company = '', groupName = 'General'] = cells;
      if (!fullName || !email) continue;
      db.contacts.push({
        id: crypto.randomUUID(),
        organisationId: org,
        userId,
        fullName,
        email,
        phone,
        company,
        jobTitle: '',
        groupName: groupName || 'General',
        notes: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      if (groupName) groupNames.add(groupName);
      if (!db.contactGroups.some((g) => g.organisationId === org && g.name === groupName)) {
        db.contactGroups.push({
          id: crypto.randomUUID(),
          userId,
          organisationId: org,
          name: groupName || 'General',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }
  });
  recordAudit(req, org, userId, req.auth!.user.email, 'CONTACTS_IMPORTED', '/api/contacts/import', 'SUCCESS', 'ADMIN_ACTIVITY');
  return res.status(201).json({ count: rows.length, groups: Array.from(groupNames) });
});

workspaceModulesRouter.get('/api/contacts/export', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const org = orgId(req)!;
  const contacts = getDb().contacts.filter((c) => c.organisationId === org);
  const header = ['Full Name', 'Email', 'Phone', 'Company', 'Group'].map(csvCell).join(',');
  const lines = contacts.map((c) => [c.fullName, c.email, c.phone, c.company, c.groupName].map(csvCell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="corivo-contacts.csv"');
  return res.status(200).send([header, ...lines].join('\r\n'));
});

// ---------------------------------------------------------------------------
// Contact groups
// ---------------------------------------------------------------------------

workspaceModulesRouter.get('/api/contact-groups', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const groups = getDb().contactGroups.filter((g) => g.organisationId === orgId(req));
  return res.json({ groups });
});

workspaceModulesRouter.post('/api/contact-groups', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return badRequest(res, 'Group name is required.');
  const group = { id: crypto.randomUUID(), organisationId: orgId(req)!, userId: req.auth!.user.id, name, createdAt: nowIso(), updatedAt: nowIso() };
  updateDb((db) => db.contactGroups.push(group));
  return res.status(201).json({ group });
});

workspaceModulesRouter.patch('/api/contact-groups/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return badRequest(res, 'Group name is required.');
  let group: unknown = null;
  updateDb((db) => {
    const target = db.contactGroups.find((g) => g.id === req.params.id && g.organisationId === orgId(req));
    if (!target) return;
    const oldName = target.name;
    target.name = name;
    target.updatedAt = nowIso();
    for (const c of db.contacts) {
      if (c.organisationId === orgId(req) && c.groupName === oldName) c.groupName = name;
    }
    group = target;
  });
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  return res.json({ group: getDb().contactGroups.find((g) => g.id === req.params.id) });
});

workspaceModulesRouter.delete('/api/contact-groups/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let group: unknown = null;
  updateDb((db) => {
    const target = db.contactGroups.find((g) => g.id === req.params.id && g.organisationId === orgId(req));
    if (!target) return;
    group = target;
    const name = target.name;
    db.contactGroups = db.contactGroups.filter((g) => g.id !== target.id);
    for (const c of db.contacts) {
      if (c.organisationId === orgId(req) && c.groupName === name) c.groupName = 'General';
    }
  });
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

workspaceModulesRouter.get('/api/calendar', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const db = getDb();
  const userId = req.auth!.user.id;
  const org = orgId(req)!;
  const events = db.calendarEvents.filter((e) => {
    if (e.organisationId !== org) return false;
    return e.userId === userId || (e.sharedWith || []).includes(userId) || (e.attendees || []).includes(req.auth!.user.email);
  });
  return res.json({ events });
});

workspaceModulesRouter.post('/api/calendar', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const parsed = calendarEventSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Invalid event.');
  const event = {
    ...parsed.data,
    id: crypto.randomUUID(),
    organisationId: orgId(req)!,
    userId: req.auth!.user.id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  updateDb((db) => db.calendarEvents.push(event));
  return res.status(201).json({ event });
});

workspaceModulesRouter.patch('/api/calendar/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const parsed = calendarEventSchema.partial().safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Invalid event.');
  let found = false;
  updateDb((db) => {
    const event = db.calendarEvents.find((e) => e.id === req.params.id && e.organisationId === orgId(req) && e.userId === req.auth!.user.id);
    if (!event) return;
    found = true;
    Object.assign(event, parsed.data, { updatedAt: nowIso() });
  });
  if (!found) return res.status(404).json({ error: 'Event not found.' });
  return res.json({ event: getDb().calendarEvents.find((e) => e.id === req.params.id) });
});

workspaceModulesRouter.delete('/api/calendar/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let found = false;
  updateDb((db) => {
    const before = db.calendarEvents.length;
    db.calendarEvents = db.calendarEvents.filter((e) => !(e.id === req.params.id && e.organisationId === orgId(req) && e.userId === req.auth!.user.id));
    found = db.calendarEvents.length < before;
  });
  if (!found) return res.status(404).json({ error: 'Event not found.' });
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

workspaceModulesRouter.get('/api/tasks', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const tasks = getDb().tasks.filter((t) => t.organisationId === orgId(req));
  return res.json({ tasks });
});

workspaceModulesRouter.post('/api/tasks', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return badRequest(res, 'Task title is required.');
  const task = {
    id: crypto.randomUUID(),
    organisationId: orgId(req)!,
    title,
    assigneeEmail: typeof req.body.assigneeEmail === 'string' ? req.body.assigneeEmail : req.auth!.user.email,
    dueDate: typeof req.body.dueDate === 'string' ? req.body.dueDate : '',
    priority: ['LOW', 'MEDIUM', 'HIGH'].includes(req.body.priority) ? req.body.priority : 'MEDIUM',
    status: 'TODO' as const,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  updateDb((db) => db.tasks.push(task));
  return res.status(201).json({ task });
});

workspaceModulesRouter.patch('/api/tasks/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let found = false;
  updateDb((db) => {
    const task = db.tasks.find((t) => t.id === req.params.id && t.organisationId === orgId(req));
    if (!task) return;
    found = true;
    const body = req.body || {};
    for (const field of ['title', 'assigneeEmail', 'dueDate', 'priority', 'status'] as const) {
      if (body[field] !== undefined) (task as unknown as Record<string, unknown>)[field] = body[field];
    }
    task.updatedAt = nowIso();
  });
  if (!found) return res.status(404).json({ error: 'Task not found.' });
  return res.json({ task: getDb().tasks.find((t) => t.id === req.params.id) });
});

workspaceModulesRouter.delete('/api/tasks/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let found = false;
  updateDb((db) => {
    const before = db.tasks.length;
    db.tasks = db.tasks.filter((t) => !(t.id === req.params.id && t.organisationId === orgId(req)));
    found = db.tasks.length < before;
  });
  if (!found) return res.status(404).json({ error: 'Task not found.' });
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

workspaceModulesRouter.get('/api/notes', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const notes = getDb().notes.filter((n) => n.organisationId === orgId(req) && n.userId === req.auth!.user.id);
  return res.json({ notes });
});

workspaceModulesRouter.post('/api/notes', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return badRequest(res, 'Note title is required.');
  const note = {
    id: crypto.randomUUID(),
    organisationId: orgId(req)!,
    userId: req.auth!.user.id,
    title,
    content: typeof req.body.content === 'string' ? req.body.content : '',
    folder: typeof req.body.folder === 'string' && req.body.folder.trim() ? req.body.folder.trim() : 'General',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  updateDb((db) => db.notes.push(note));
  return res.status(201).json({ note });
});

workspaceModulesRouter.patch('/api/notes/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let found = false;
  updateDb((db) => {
    const note = db.notes.find((n) => n.id === req.params.id && n.organisationId === orgId(req) && n.userId === req.auth!.user.id);
    if (!note) return;
    found = true;
    const body = req.body || {};
    for (const field of ['title', 'content', 'folder'] as const) {
      if (typeof body[field] === 'string') (note as unknown as Record<string, unknown>)[field] = body[field];
    }
    note.updatedAt = nowIso();
  });
  if (!found) return res.status(404).json({ error: 'Note not found.' });
  return res.json({ note: getDb().notes.find((n) => n.id === req.params.id) });
});

workspaceModulesRouter.delete('/api/notes/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let found = false;
  updateDb((db) => {
    const before = db.notes.length;
    db.notes = db.notes.filter((n) => !(n.id === req.params.id && n.organisationId === orgId(req) && n.userId === req.auth!.user.id));
    found = db.notes.length < before;
  });
  if (!found) return res.status(404).json({ error: 'Note not found.' });
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Shared mailboxes
// ---------------------------------------------------------------------------

workspaceModulesRouter.get('/api/shared-mailboxes', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const shared = getDb().sharedMailboxes.filter((mb) => mb.organisationId === orgId(req));
  return res.json({ sharedMailboxes: shared });
});

workspaceModulesRouter.post('/api/shared-mailboxes', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const emailAddress = typeof req.body?.emailAddress === 'string' ? req.body.emailAddress.trim() : '';
  if (!name || !emailAddress) return badRequest(res, 'Name and email address are required.');
  const members = Array.isArray(req.body.members) ? req.body.members : [];
  const shared = {
    id: crypto.randomUUID(),
    organisationId: orgId(req)!,
    name,
    emailAddress,
    description: typeof req.body.description === 'string' ? req.body.description : '',
    members: members.filter((m: { email?: string }) => m && typeof m.email === 'string' && m.email.trim()),
    recentActivity: 'Created just now',
    createdAt: nowIso(),
  };
  updateDb((db) => db.sharedMailboxes.push(shared));
  return res.status(201).json({ sharedMailbox: shared });
});

workspaceModulesRouter.patch('/api/shared-mailboxes/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let found = false;
  updateDb((db) => {
    const mb = db.sharedMailboxes.find((s) => s.id === req.params.id && s.organisationId === orgId(req));
    if (!mb) return;
    found = true;
    const body = req.body || {};
    for (const field of ['name', 'emailAddress', 'description', 'recentActivity'] as const) {
      if (typeof body[field] === 'string') (mb as unknown as Record<string, unknown>)[field] = body[field];
    }
    if (Array.isArray(body.members)) mb.members = body.members;
  });
  if (!found) return res.status(404).json({ error: 'Shared mailbox not found.' });
  return res.json({ sharedMailbox: getDb().sharedMailboxes.find((s) => s.id === req.params.id) });
});

workspaceModulesRouter.delete('/api/shared-mailboxes/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let found = false;
  updateDb((db) => {
    const before = db.sharedMailboxes.length;
    db.sharedMailboxes = db.sharedMailboxes.filter((s) => !(s.id === req.params.id && s.organisationId === orgId(req)));
    found = db.sharedMailboxes.length < before;
  });
  if (!found) return res.status(404).json({ error: 'Shared mailbox not found.' });
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Migration jobs (state machine, simulated delivery)
// ---------------------------------------------------------------------------

const migrationSchema = z.object({
  sourceProvider: z.enum(['GMAIL', 'ZOHO', 'OUTLOOK', 'IMAP']).optional().default('IMAP'),
  sourceAccount: z.string().trim().min(3, 'Source account is required'),
  targetMailbox: z.string().trim().min(3, 'Target mailbox is required'),
});

workspaceModulesRouter.get('/api/migration', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const jobs = getDb().migrationJobs.filter((j) => j.organisationId === orgId(req));
  return res.json({ jobs });
});

workspaceModulesRouter.post('/api/migration', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const parsed = migrationSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Invalid migration request.');
  const totalItems = 120 + Math.floor(Math.random() * 80);
  const job = {
    id: crypto.randomUUID(),
    organisationId: orgId(req)!,
    sourceProvider: parsed.data.sourceProvider,
    sourceAccount: parsed.data.sourceAccount,
    targetMailbox: parsed.data.targetMailbox,
    status: 'COMPLETED' as const,
    totalItems,
    successCount: totalItems,
    failedCount: 0,
    errorDetail: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  updateDb((db) => db.migrationJobs.push(job));
  recordAudit(req, orgId(req), req.auth!.user.id, req.auth!.user.email, 'MIGRATION_STARTED', '/api/migration', 'SUCCESS', 'ADMIN_ACTIVITY');
  return res.status(201).json({ job, mode: 'DEVELOPMENT_SIMULATED' });
});

workspaceModulesRouter.get('/api/migration/:id', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  const job = getDb().migrationJobs.find((j) => j.id === req.params.id && j.organisationId === orgId(req));
  if (!job) return res.status(404).json({ error: 'Migration job not found.' });
  return res.json({ job, mode: 'DEVELOPMENT_SIMULATED' });
});

workspaceModulesRouter.post('/api/migration/:id/retry', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let job: unknown = null;
  updateDb((db) => {
    const target = db.migrationJobs.find((j) => j.id === req.params.id && j.organisationId === orgId(req));
    if (!target) return;
    target.status = 'COMPLETED';
    target.failedCount = 0;
    target.successCount = target.totalItems;
    target.updatedAt = nowIso();
    job = target;
  });
  if (!job) return res.status(404).json({ error: 'Migration job not found.' });
  return res.json({ job: getDb().migrationJobs.find((j) => j.id === req.params.id), mode: 'DEVELOPMENT_SIMULATED' });
});

workspaceModulesRouter.post('/api/migration/:id/cancel', requireAuth, requireOrganisationMember, (req: AuthedRequest, res) => {
  let job: unknown = null;
  updateDb((db) => {
    const target = db.migrationJobs.find((j) => j.id === req.params.id && j.organisationId === orgId(req));
    if (!target) return;
    target.status = 'FAILED';
    target.errorDetail = 'Cancelled by user.';
    target.updatedAt = nowIso();
    job = target;
  });
  if (!job) return res.status(404).json({ error: 'Migration job not found.' });
  return res.json({ job: getDb().migrationJobs.find((j) => j.id === req.params.id) });
});

export default workspaceModulesRouter;
