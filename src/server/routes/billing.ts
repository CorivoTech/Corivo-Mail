import { Router } from 'express';

export const billingRouter = Router();

billingRouter.get('/api/billing/plans', function(req, res) {
  res.json({ plans: [
    { code: 'STARTER', name: 'Starter', priceInrPerSeat: 149, storageGb: 10, trialDays: 14, features: ['10 GB mailbox storage', '1 custom domain', 'SPF & DKIM authentication', 'Webmail, contacts & calendar'] },
    { code: 'BUSINESS', name: 'Business', priceInrPerSeat: 299, storageGb: 30, trialDays: 14, features: ['30 GB mailbox storage', 'Up to 10 domains', 'Aliases, groups & shared mailboxes', 'Deliverability & queue monitoring'] },
    { code: 'ENTERPRISE', name: 'Enterprise', priceInrPerSeat: 549, storageGb: 100, trialDays: 30, features: ['100 GB mailbox storage', 'Unlimited domains', 'Compliance audit logs & retention', 'Dedicated migration & security policies'] },
  ] });
});

billingRouter.get('/api/billing/subscription', function(req, res) {
  res.json({ subscription: { plan: 'BUSINESS', trialEndsAt: null, status: 'active' } });
});

billingRouter.post('/api/billing/subscription', function(req, res) {
  res.json({ ok: true, mode: 'DEVELOPMENT_SIMULATED' });
});

billingRouter.post('/api/billing/subscription/cancel', function(req, res) {
  res.json({ ok: true, mode: 'DEVELOPMENT_SIMULATED' });
});

billingRouter.get('/api/billing/invoices', function(req, res) {
  res.json({ invoices: [
    { id: 'inv-1', number: 'INV-2026-001', status: 'paid', issueDate: new Date().toISOString(), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), totalAmount: 29900, gst: 4500, lineItems: ['20 seats × ₹299', '30 GB storage'] },
    { id: 'inv-2', number: 'INV-2026-002', status: 'pending', issueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), dueDate: new Date().toISOString(), totalAmount: 14900, gst: 2235, lineItems: ['10 seats × ₹149'] },
  ] });
});

billingRouter.get('/api/billing/invoices/:id', function(req, res) {
  res.json({ invoice: { id: req.params.id, number: 'INV-2026-001', status: 'paid', issueDate: new Date().toISOString(), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), totalAmount: 29900, gst: 4500, lineItems: ['20 seats × ₹299', '30 GB storage'], gstRate: 18 } });
});

billingRouter.post('/api/billing/invoices/:id/pay', function(req, res) {
  res.json({ ok: true, mode: 'DEVELOPMENT_SIMULATED' });
});

billingRouter.get('/api/billing/payment-methods', function(req, res) {
  res.json({ methods: [] });
});

billingRouter.post('/api/billing/payment-methods', function(req, res) {
  res.json({ ok: true });
});

billingRouter.delete('/api/billing/payment-methods/:id', function(req, res) {
  res.json({ ok: true });
});

billingRouter.get('/api/billing/usage', function(req, res) {
  res.json({ seats: 5, storageUsedMb: 2048, storageQuotaMb: 30720, percentUsed: 6.7 });
});