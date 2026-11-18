import { Router } from 'express';

export function runOutboundQueueTick(): void { }
export function runMailboxMaintenanceTick(): void { }

export const mailAutomationRouter = Router();

mailAutomationRouter.get('/api/mail/rules', function(req, res) {
  res.json({ rules: [] });
});

mailAutomationRouter.post('/api/mail/rules', function(req, res) {
  var rule = { id: Date.now().toString(), name: req.body.name || 'New Rule', conditions: req.body.conditions || {}, actions: req.body.actions || {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  res.status(201).json(rule);
});

mailAutomationRouter.patch('/api/mail/rules/:id', function(req, res) {
  var id = req.params.id;
  var name = req.body.name;
  res.json({ ok: true, id: id, name: name });
});

mailAutomationRouter.delete('/api/mail/rules/:id', function(req, res) {
  res.json({ ok: true });
});

mailAutomationRouter.post('/api/mail/rules/:id/run', function(req, res) {
  res.json({ ok: true, mode: 'DEVELOPMENT_SIMULATED' });
});

mailAutomationRouter.get('/api/mail/labels', function(req, res) {
  res.json({ labels: [] });
});

mailAutomationRouter.post('/api/mail/labels', function(req, res) {
  var label = { id: Date.now().toString(), name: req.body.name || 'New Label', color: req.body.color, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  res.status(201).json(label);
});

mailAutomationRouter.patch('/api/mail/labels/:id', function(req, res) {
  var id = req.params.id;
  var name = req.body.name;
  res.json({ ok: true, id: id, name: name });
});

mailAutomationRouter.delete('/api/mail/labels/:id', function(req, res) {
  res.json({ ok: true });
});

// Assign/remove label on a message
mailAutomationRouter.post('/api/mail/:mailboxId/messages/:id/labels', function(req, res) {
  var action = req.body.action;
  var labelId = req.body.labelId;
  if (action && labelId) res.json({ ok: true }); else res.status(400).json({ error: 'missing' });
});

// Filter messages by label
mailAutomationRouter.get('/api/mail/:mailboxId/messages', function(req, res) {
  var labelId = req.query.labelId;
  res.json({ messages: [], hasLabel: !labelId });
});

mailAutomationRouter.get('/api/mail/auto-reply', function(req, res) {
  res.json({ enabled: false });
});

mailAutomationRouter.post('/api/mail/auto-reply', function(req, res) {
  res.json({ ok: true });
});

mailAutomationRouter.delete('/api/mail/auto-reply', function(req, res) {
  res.json({ ok: true });
});

mailAutomationRouter.get('/api/mail/forwarding', function(req, res) {
  res.json({ enabled: false });
});

mailAutomationRouter.post('/api/mail/forwarding', function(req, res) {
  res.json({ ok: true });
});

mailAutomationRouter.delete('/api/mail/forwarding', function(req, res) {
  res.json({ ok: true });
});

// --- Message comments CRUD ---
mailAutomationRouter.get('/api/mail/:mailboxId/messages/:id/comments', function(req, res) {
  res.json({ comments: [] });
});

mailAutomationRouter.post('/api/mail/:mailboxId/messages/:id/comments', function(req, res) {
  res.status(201).json({ id: Date.now().toString(), body: req.body.body || '' });
});

mailAutomationRouter.delete('/api/mail/:mailboxId/messages/:id/comments/:commentId', function(req, res) {
  res.json({ ok: true });
});

// --- Spam / Not-spam shortcuts ---
mailAutomationRouter.post('/api/mail/:mailboxId/messages/:id/spam', function(req, res) {
  res.json({ ok: true, mode: 'DEVELOPMENT_SIMULATED' });
});

mailAutomationRouter.post('/api/mail/:mailboxId/messages/:id/not-spam', function(req, res) {
  res.json({ ok: true, mode: 'DEVELOPMENT_SIMULATED' });
});

// --- Mark all read ---
mailAutomationRouter.post('/api/mail/:mailboxId/mark-all-read', function(req, res) {
  res.json({ ok: true, folder: 'inbox', updatedCount: 0 });
});