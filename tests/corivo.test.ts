import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import express from 'express';

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'corivo-mail-test-'));
process.env.CORIVO_DATA_DIR = TEST_DATA_DIR;

const { getDb, resetDbCacheForTests } = await import('../src/server/db/store.ts');
const { DEV_DEMO_PASSWORD } = await import('../src/server/db/seed.ts');
const { authRouter } = await import('../src/server/routes/auth.ts');
const { mailRouter } = await import('../src/server/routes/mail.ts');
const { adminRouter } = await import('../src/server/routes/admin.ts');
const { platformRouter } = await import('../src/server/routes/platform.ts');
const { workspaceModulesRouter } = await import('../src/server/routes/workspaceModules.ts');

let server: Server;
let baseUrl = '';

async function loginAs(email: string, password = DEV_DEMO_PASSWORD): Promise<{ status: number; cookie: string; body: any }> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get('set-cookie')?.split(';')[0] || '';
  const body = await res.json();
  return { status: res.status, cookie, body };
}

before(async () => {
  resetDbCacheForTests();
  getDb();
  const app = express();
  app.use(express.json({ limit: '35mb' }));
  app.use(cookieParser());
  app.use(authRouter);
  app.use(mailRouter);
  app.use(adminRouter);
  app.use(platformRouter);
  app.use(workspaceModulesRouter);
  app.use((err: Error & { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError || err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON request body.' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

describe('Corivo Mail Authentication & Session Tests', () => {
  it('logs in valid demo owner and issues HTTP-only session cookie', async () => {
    const res = await loginAs('razeen@corivotech.example');
    assert.equal(res.status, 200);
    assert.ok(res.cookie.startsWith('corivo_session='));
    assert.equal(res.body.session.user.email, 'razeen@corivotech.example');
    assert.equal(res.body.session.membership.roleKey, 'OWNER');
  });

  it('rejects invalid password with 401', async () => {
    const res = await loginAs('razeen@corivotech.example', 'WrongPassword123!');
    assert.equal(res.status, 401);
  });

  it('blocks suspended user account from logging in', async () => {
    const res = await loginAs('suspended@corivotech.example');
    assert.equal(res.status, 403);
    assert.match(res.body.error, /suspended/i);
  });

  it('completes forgot-password -> reset-password flow', async () => {
    const forgot = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vikram@corivotech.example' }),
    });
    assert.equal(forgot.status, 200);
    const forgotBody = await forgot.json();
    assert.ok(forgotBody.devResetToken);

    const reset = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: forgotBody.devResetToken,
        password: 'NewStrongPassword!2026',
        confirmPassword: 'NewStrongPassword!2026',
      }),
    });
    assert.equal(reset.status, 200);

    const loginNew = await loginAs('vikram@corivotech.example', 'NewStrongPassword!2026');
    assert.equal(loginNew.status, 200);
  });
});

describe('RBAC & Strict Multi-Tenant Isolation Tests', () => {
  it('blocks Mailbox User from accessing Admin Console APIs', async () => {
    const user = await loginAs('ananya@corivotech.example');
    assert.equal(user.status, 200);

    const adminRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Cookie: user.cookie },
    });
    assert.equal(adminRes.status, 403);
  });

  it('blocks Organisation Admin from Owner-only legal entity & role matrix changes', async () => {
    const admin = await loginAs('admin@corivotech.example');
    assert.equal(admin.status, 200);

    const legalRes = await fetch(`${baseUrl}/api/organisations/current`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
      body: JSON.stringify({ legalName: 'Tampered Legal Name' }),
    });
    assert.equal(legalRes.status, 403);

    const roleRes = await fetch(`${baseUrl}/api/admin/roles`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
      body: JSON.stringify({ roleKey: 'ADMIN', permissions: ['domains.manage'] }),
    });
    assert.equal(roleRes.status, 403);
  });

  it('prevents cross-tenant access between Corivo Tech and Vanguard Logistics', async () => {
    const corivoOwner = await loginAs('razeen@corivotech.example');
    const vanguardOwner = await loginAs('priya@vanguardlogistics.example');

    const corivoMailboxes = await (
      await fetch(`${baseUrl}/api/mailboxes`, { headers: { Cookie: corivoOwner.cookie } })
    ).json();
    const targetMailboxId = corivoMailboxes.mailboxes[0].id;

    // Vanguard owner must get 404 when trying to inspect Corivo Tech's mailbox
    const crossRead = await fetch(`${baseUrl}/api/mailboxes/${targetMailboxId}`, {
      headers: { Cookie: vanguardOwner.cookie },
    });
    assert.equal(crossRead.status, 404);

    // Vanguard owner must not see Corivo Tech domains
    const vanguardDomains = await (
      await fetch(`${baseUrl}/api/domains`, { headers: { Cookie: vanguardOwner.cookie } })
    ).json();
    assert.ok(vanguardDomains.domains.every((d: any) => d.domainName !== 'corivotech.example'));
  });

  it('enforces Platform Admin isolation from customer email bodies', async () => {
    const op = await loginAs('operator@corivomail.example');
    assert.equal(op.status, 200);

    const orgsRes = await (
      await fetch(`${baseUrl}/api/platform/organisations`, { headers: { Cookie: op.cookie } })
    ).json();
    const firstOrgId = orgsRes.organisations[0].id;

    const detailRes = await (
      await fetch(`${baseUrl}/api/platform/organisations/${firstOrgId}`, {
        headers: { Cookie: op.cookie },
      })
    ).json();
    assert.equal(detailRes.messages, undefined);
    assert.ok(detailRes.organisation);

    // Platform operator does not have an org mailbox for customer webmail
    const mailAttempt = await fetch(`${baseUrl}/api/mail?folder=inbox`, {
      headers: { Cookie: op.cookie },
    });
    assert.equal(mailAttempt.status, 403);
  });
});

describe('Domain Verification, Mail Sending & Admin Operations Tests', () => {
  it('validates domain format, rejects duplicates, and runs simulated DNS check', async () => {
    const owner = await loginAs('razeen@corivotech.example');

    const badDomain = await fetch(`${baseUrl}/api/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ domainName: 'invalid_domain', isPrimary: false }),
    });
    assert.equal(badDomain.status, 400);

    const dupDomain = await fetch(`${baseUrl}/api/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ domainName: 'corivotech.example', isPrimary: false }),
    });
    assert.equal(dupDomain.status, 409);

    const newDomainRes = await fetch(`${baseUrl}/api/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ domainName: 'corivonew.example', isPrimary: false }),
    });
    assert.equal(newDomainRes.status, 201);
    const { domain } = await newDomainRes.json();

    const verifyRes = await fetch(`${baseUrl}/api/domains/${domain.id}/verify`, {
      method: 'POST',
      headers: { Cookie: owner.cookie },
    });
    assert.equal(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.domain.ownershipStatus, 'VERIFIED');
  });

  it('blocks executable attachments, creates draft, and simulates bounce delivery status', async () => {
    const user = await loginAs('razeen@corivotech.example');

    // Blocked executable file
    const badUpload = await fetch(`${baseUrl}/api/attachments/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({
        fileName: 'payload.exe',
        mimeType: 'application/octet-stream',
        contentBase64: Buffer.from('MZ').toString('base64'),
      }),
    });
    assert.equal(badUpload.status, 400);

    // Oversized > 25 MB check
    const bigRes = await fetch(`${baseUrl}/api/attachments/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({
        fileName: 'huge.pdf',
        mimeType: 'application/pdf',
        contentBase64: 'A'.repeat(34 * 1024 * 1024),
      }),
    });
    assert.equal(bigRes.status, 413);
    const bigBody = await bigRes.json();
    assert.match(bigBody.error, /25 MB/i);

    // Create & retrieve draft
    const draftRes = await fetch(`${baseUrl}/api/mail/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({
        to: ['ananya@corivotech.example'],
        subject: 'Draft Follow-up',
        bodyHtml: '<p>Saved draft body</p>',
      }),
    });
    assert.equal(draftRes.status, 201);
    const { draft } = await draftRes.json();

    // Send normal email from draft
    const normalSendRes = await fetch(`${baseUrl}/api/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({
        to: ['ananya@corivotech.example'],
        cc: [],
        bcc: [],
        subject: 'Automated Acceptance Test',
        bodyHtml: '<p>Testing clean delivery.</p>',
        attachmentIds: [],
        draftId: draft.id,
      }),
    });
    assert.equal(normalSendRes.status, 201);
    const normalSendBody = await normalSendRes.json();
    assert.equal(normalSendBody.message.deliveryStatus, 'ACCEPTED');

    // Send email triggering simulated 550 bounce
    const bounceRes = await fetch(`${baseUrl}/api/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({
        to: ['bounce-test@external.example'],
        cc: [],
        bcc: [],
        subject: 'Automated Bounce Test',
        bodyHtml: '<p>Testing delivery bounce simulation.</p>',
        attachmentIds: [],
      }),
    });
    assert.equal(bounceRes.status, 502);
    const bounceBody = await bounceRes.json();
    assert.equal(bounceBody.message.deliveryStatus, 'BOUNCED');
  });

  it('creates mailbox, updates quota, and suspends/reactivates mailbox', async () => {
    const admin = await loginAs('admin@corivotech.example');
    const domRes = await (
      await fetch(`${baseUrl}/api/domains`, { headers: { Cookie: admin.cookie } })
    ).json();
    const domainId = domRes.domains[0].id;

    const createRes = await fetch(`${baseUrl}/api/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
      body: JSON.stringify({
        firstName: 'Kavya',
        lastName: 'Rao',
        username: 'kavya.rao',
        domainId,
        password: 'KavyaStrongPassword!2026',
        quotaMb: 10240,
        roleKey: 'MAILBOX_USER',
      }),
    });
    assert.equal(createRes.status, 201);
    const { mailbox } = await createRes.json();
    assert.equal(mailbox.emailAddress, 'kavya.rao@corivotech.example');

    const patchRes = await fetch(`${baseUrl}/api/mailboxes/${mailbox.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
      body: JSON.stringify({ quotaMb: 20480 }),
    });
    assert.equal(patchRes.status, 200);
    assert.equal((await patchRes.json()).mailbox.quotaMb, 20480);

    const suspendRes = await fetch(`${baseUrl}/api/mailboxes/${mailbox.id}/suspend`, {
      method: 'POST',
      headers: { Cookie: admin.cookie },
    });
    assert.equal(suspendRes.status, 200);
    assert.equal((await suspendRes.json()).mailbox.status, 'SUSPENDED');

    const reactivateRes = await fetch(`${baseUrl}/api/mailboxes/${mailbox.id}/reactivate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie },
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal((await reactivateRes.json()).mailbox.status, 'ACTIVE');
  });
});

describe('Audit Completion Coverage Tests', () => {
  it('supports profile avatar updates and lists organisation members', async () => {
    const owner = await loginAs('razeen@corivotech.example');

    const avatarData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const profileRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({
        firstName: 'Razeen',
        lastName: 'Khan',
        displayName: 'Razeen Khan',
        jobTitle: 'Founder & CEO',
        department: 'Executive',
        phone: '+91 9800000010',
        avatarUrl: avatarData,
      }),
    });
    assert.equal(profileRes.status, 200);
    const profileBody = await profileRes.json();
    assert.equal(profileBody.user.avatarUrl, avatarData);

    const membersRes = await fetch(`${baseUrl}/api/organisations/members`, {
      headers: { Cookie: owner.cookie },
    });
    assert.equal(membersRes.status, 200);
    const membersBody = await membersRes.json();
    assert.ok(Array.isArray(membersBody.members) && membersBody.members.length > 0);
  });

  it('supports mail reply, forward, and unsnooze endpoints', async () => {
    const owner = await loginAs('razeen@corivotech.example');
    const inboxRes = await (
      await fetch(`${baseUrl}/api/mail?folder=inbox`, { headers: { Cookie: owner.cookie } })
    ).json();
    const targetMsg = inboxRes.messages[0];
    assert.ok(targetMsg);

    const snoozeRes = await fetch(`${baseUrl}/api/mail/${targetMsg.id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ snoozedUntil: new Date(Date.now() + 86400_000).toISOString() }),
    });
    assert.equal(snoozeRes.status, 200);
    assert.equal((await snoozeRes.json()).message.folderSlug, 'snoozed');

    const unsnoozeRes = await fetch(`${baseUrl}/api/mail/${targetMsg.id}/unsnooze`, {
      method: 'POST',
      headers: { Cookie: owner.cookie },
    });
    assert.equal(unsnoozeRes.status, 200);
    assert.equal((await unsnoozeRes.json()).message.folderSlug, 'inbox');

    const replyRes = await fetch(`${baseUrl}/api/mail/${targetMsg.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ bodyHtml: '<p>Thanks, confirming receipt.</p>' }),
    });
    assert.equal(replyRes.status, 201);
    const replyBody = await replyRes.json();
    assert.match(replyBody.message.subject, /^Re:/);

    const forwardRes = await fetch(`${baseUrl}/api/mail/${targetMsg.id}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ to: ['ananya@corivotech.example'], bodyHtml: '<p>FYI below.</p>' }),
    });
    assert.equal(forwardRes.status, 201);
    const forwardBody = await forwardRes.json();
    assert.match(forwardBody.message.subject, /^Fwd:/);
  });

  it('supports domain DNS inspection, domain PATCH, group PATCH, usage storageTrends, migration retry, and platform workers health', async () => {
    const owner = await loginAs('razeen@corivotech.example');

    const doms = await (await fetch(`${baseUrl}/api/domains`, { headers: { Cookie: owner.cookie } })).json();
    const firstDom = doms.domains[0];
    assert.ok(firstDom);

    const dnsRes = await fetch(`${baseUrl}/api/domains/${firstDom.id}/dns`, { headers: { Cookie: owner.cookie } });
    assert.equal(dnsRes.status, 200);
    const dnsBody = await dnsRes.json();
    assert.ok(Array.isArray(dnsBody.dnsRecords) && dnsBody.dnsRecords.length >= 4);

    const domPatch = await fetch(`${baseUrl}/api/domains/${firstDom.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ tlsStatus: 'ENFORCED' }),
    });
    assert.equal(domPatch.status, 200);
    assert.equal((await domPatch.json()).domain.tlsStatus, 'ENFORCED');

    const groupsRes = await (await fetch(`${baseUrl}/api/aliases`, { headers: { Cookie: owner.cookie } })).json();
    const firstGroup = groupsRes.groups[0];
    assert.ok(firstGroup);
    const grpPatch = await fetch(`${baseUrl}/api/groups/${firstGroup.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({
        name: firstGroup.name,
        emailAddress: firstGroup.emailAddress,
        description: 'Updated via audit test',
        members: firstGroup.members,
      }),
    });
    assert.equal(grpPatch.status, 200);
    assert.equal((await grpPatch.json()).group.description, 'Updated via audit test');

    const usageRes = await fetch(`${baseUrl}/api/admin/usage`, { headers: { Cookie: owner.cookie } });
    assert.equal(usageRes.status, 200);
    const usageBody = await usageRes.json();
    assert.ok(Array.isArray(usageBody.storageTrends) && usageBody.storageTrends.length >= 3);

    const migCreate = await fetch(`${baseUrl}/api/migration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({
        sourceProvider: 'IMAP',
        sourceAccount: 'legacy@partner.example',
        targetMailbox: 'razeen@corivotech.example',
      }),
    });
    assert.equal(migCreate.status, 201);
    const { job } = await migCreate.json();

    const retryRes = await fetch(`${baseUrl}/api/migration/${job.id}/retry`, {
      method: 'POST',
      headers: { Cookie: owner.cookie },
    });
    assert.equal(retryRes.status, 200);
    const retryBody = await retryRes.json();
    assert.equal(retryBody.job.failedCount, 0);

    const op = await loginAs('operator@corivomail.example');
    const healthRes = await fetch(`${baseUrl}/api/platform/health`, { headers: { Cookie: op.cookie } });
    assert.equal(healthRes.status, 200);
    const healthBody = await healthRes.json();
    assert.ok(healthBody.services.some((s: any) => s.service === 'Background Workers'));
  });
});

describe('User Account & Settings Centre Tests', () => {
  it('persists preferences, rejects invalid timezone/font, and sanitizes signature HTML', async () => {
    const user = await loginAs('ananya@corivotech.example');
    assert.equal(user.status, 200);

    const badTz = await fetch(`${baseUrl}/api/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ timezone: 'Mars/Olympus_Mons' }),
    });
    assert.equal(badTz.status, 400);

    const badAvatar = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({
        firstName: 'Ananya',
        lastName: 'Sharma',
        displayName: 'Ananya Sharma',
        avatarUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      }),
    });
    assert.equal(badAvatar.status, 400);

    const patchPrefs = await fetch(`${baseUrl}/api/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({
        language: 'en-GB',
        timezone: 'Europe/London',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h',
        theme: 'dark',
        density: 'compact',
        defaultReplyMode: 'reply_all',
        threadingEnabled: false,
        defaultFont: 'Plus Jakarta Sans',
        confirmBeforeSend: true,
        signatureEnabled: true,
        signatureHtml: '<p><strong>Ananya</strong></p><script>alert(1)</script>',
        newEmailAlerts: false,
      }),
    });
    assert.equal(patchPrefs.status, 200);
    const prefBody = await patchPrefs.json();
    assert.equal(prefBody.preferences.theme, 'dark');
    assert.equal(prefBody.preferences.density, 'compact');
    assert.equal(prefBody.preferences.threadingEnabled, false);
    assert.equal(prefBody.preferences.defaultReplyMode, 'reply_all');
    assert.equal(prefBody.preferences.newEmailAlerts, false);
    assert.ok(!prefBody.preferences.signatureHtml.includes('<script'));
  });

  it('validates password changes, manages secondary sessions, computes storage breakdown, and updates notifications', async () => {
    const firstSession = await loginAs('ananya@corivotech.example');
    const secondSession = await loginAs('ananya@corivotech.example');

    const sessRes = await fetch(`${baseUrl}/api/users/me/sessions`, {
      headers: { Cookie: secondSession.cookie },
    });
    assert.equal(sessRes.status, 200);
    const sessBody = await sessRes.json();
    assert.ok(sessBody.sessions.length >= 2);
    assert.ok(sessBody.passwordPolicy.minPasswordLength >= 10);

    const otherSession = sessBody.sessions.find((s: any) => !s.isCurrent);
    assert.ok(otherSession);

    const missingDelete = await fetch(`${baseUrl}/api/users/me/sessions/non-existent-id`, {
      method: 'DELETE',
      headers: { Cookie: secondSession.cookie },
    });
    assert.equal(missingDelete.status, 404);

    const revokeOther = await fetch(`${baseUrl}/api/users/me/sessions/${otherSession.id}`, {
      method: 'DELETE',
      headers: { Cookie: secondSession.cookie },
    });
    assert.equal(revokeOther.status, 200);

    // First session should now be unauthorized
    const staleCheck = await fetch(`${baseUrl}/api/users/me/storage`, {
      headers: { Cookie: firstSession.cookie },
    });
    assert.equal(staleCheck.status, 401);

    const storageRes = await fetch(`${baseUrl}/api/users/me/storage`, {
      headers: { Cookie: secondSession.cookie },
    });
    assert.equal(storageRes.status, 200);
    const storageBody = await storageRes.json();
    assert.equal(storageBody.hasMailbox, true);
    assert.ok(storageBody.breakdown && typeof storageBody.breakdown.messageCount === 'number');

    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Cookie: secondSession.cookie },
    });
    assert.equal(notifRes.status, 200);
    const notifBody = await notifRes.json();
    if (notifBody.notifications.length > 0) {
      const readOne = await fetch(`${baseUrl}/api/notifications/${notifBody.notifications[0].id}/read`, {
        method: 'POST',
        headers: { Cookie: secondSession.cookie },
      });
      assert.equal(readOne.status, 200);
    }

    const wrongCurPass = await fetch(`${baseUrl}/api/users/me/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: secondSession.cookie },
      body: JSON.stringify({
        currentPassword: 'WrongPassword!123',
        newPassword: 'AnanyaUpdated!2026',
        confirmPassword: 'AnanyaUpdated!2026',
        invalidateOtherSessions: true,
      }),
    });
    assert.equal(wrongCurPass.status, 400);

    const changePass = await fetch(`${baseUrl}/api/users/me/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: secondSession.cookie },
      body: JSON.stringify({
        currentPassword: DEV_DEMO_PASSWORD,
        newPassword: 'AnanyaUpdated!2026',
        confirmPassword: 'AnanyaUpdated!2026',
        invalidateOtherSessions: true,
      }),
    });
    assert.equal(changePass.status, 200);

    const reLogin = await loginAs('ananya@corivotech.example', 'AnanyaUpdated!2026');
    assert.equal(reLogin.status, 200);
  });
});

describe('Production-Readiness Security & Isolation Tests', () => {
  it('denies cross-user same-org attachment download and prevents XSS/header injection', async () => {
    const sender = await loginAs('razeen@corivotech.example');
    const colleague = await loginAs('admin@corivotech.example');

    const uploadRes = await fetch(`${baseUrl}/api/attachments/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sender.cookie },
      body: JSON.stringify({
        fileName: 'report"bad\r\n.txt',
        mimeType: 'text/plain',
        contentBase64: Buffer.from('confidential-payroll-data').toString('base64'),
      }),
    });
    assert.equal(uploadRes.status, 201);
    const { attachment } = await uploadRes.json();

    // Same-org colleague without mailbox ownership/message access must be denied
    const colleagueDownload = await fetch(`${baseUrl}/api/attachments/${attachment.id}/download`, {
      headers: { Cookie: colleague.cookie },
    });
    assert.equal(colleagueDownload.status, 404);

    // Owner can download and Content-Disposition quotes/newlines are sanitized
    const ownerDownload = await fetch(`${baseUrl}/api/attachments/${attachment.id}/download`, {
      headers: { Cookie: sender.cookie },
    });
    assert.equal(ownerDownload.status, 200);
    assert.equal(ownerDownload.headers.get('x-content-type-options'), 'nosniff');
    const disp = ownerDownload.headers.get('content-disposition') || '';
    assert.ok(!disp.includes('\r') && !disp.includes('\n'));

    // XSS payload in mail send & draft is sanitized
    const xssSend = await fetch(`${baseUrl}/api/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sender.cookie },
      body: JSON.stringify({
        to: ['admin@corivotech.example'],
        cc: [],
        bcc: [],
        subject: 'Sanitization Test',
        bodyHtml: '<p onclick="alert(1)">Hello</p><script>alert(2)</script><a href="javascript:alert(3)">click</a>',
        attachmentIds: [],
      }),
    });
    assert.equal(xssSend.status, 201);
    const sentBody = (await xssSend.json()).message.bodyHtml as string;
    assert.ok(!sentBody.includes('<script'));
    assert.ok(!sentBody.includes('onclick='));
    assert.ok(!sentBody.includes('javascript:'));
  });

  it('prevents cross-tenant thread linking, cross-tenant note/calendar mutation, and invalid moves/snoozes', async () => {
    const corivoOwner = await loginAs('razeen@corivotech.example');
    const vanguardOwner = await loginAs('priya@vanguardlogistics.example');

    const corivoInbox = await (
      await fetch(`${baseUrl}/api/mail?folder=inbox`, { headers: { Cookie: corivoOwner.cookie } })
    ).json();
    const corivoMsg = corivoInbox.messages[0];
    assert.ok(corivoMsg);

    // Cross-tenant inReplyToId must not inherit Corivo Tech threadId
    const crossReply = await fetch(`${baseUrl}/api/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: vanguardOwner.cookie },
      body: JSON.stringify({
        to: ['priya@vanguardlogistics.example'],
        cc: [],
        bcc: [],
        subject: 'Thread Probe',
        bodyHtml: '<p>Testing thread isolation.</p>',
        attachmentIds: [],
        inReplyToId: corivoMsg.id,
      }),
    });
    assert.equal(crossReply.status, 201);
    const crossReplyBody = await crossReply.json();
    assert.notEqual(crossReplyBody.message.threadId, corivoMsg.threadId);

    // Invalid folder move rejected
    const badMove = await fetch(`${baseUrl}/api/mail/${corivoMsg.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: corivoOwner.cookie },
      body: JSON.stringify({ folderSlug: 'nonexistent-folder-xyz' }),
    });
    assert.equal(badMove.status, 400);

    // Past snooze timestamp rejected
    const badSnooze = await fetch(`${baseUrl}/api/mail/${corivoMsg.id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: corivoOwner.cookie },
      body: JSON.stringify({ snoozedUntil: '2020-01-01T00:00:00.000Z' }),
    });
    assert.equal(badSnooze.status, 400);

    // Cross-tenant note deletion rejected with 404
    const noteRes = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: corivoOwner.cookie },
      body: JSON.stringify({ title: 'Tenant Secret', content: 'Internal note', folder: 'General' }),
    });
    assert.equal(noteRes.status, 201);
    const { note } = await noteRes.json();

    const crossDelNote = await fetch(`${baseUrl}/api/notes/${note.id}`, {
      method: 'DELETE',
      headers: { Cookie: vanguardOwner.cookie },
    });
    assert.equal(crossDelNote.status, 404);
  });

  it('enforces password complexity on admin reset & platform ops, scope on platform ops, CSV hardening, and 400 on malformed JSON', async () => {
    const owner = await loginAs('razeen@corivotech.example');
    const mailboxesBody = await (
      await fetch(`${baseUrl}/api/mailboxes`, { headers: { Cookie: owner.cookie } })
    ).json();
    const vikramMb = mailboxesBody.mailboxes.find((m: any) => m.emailAddress === 'vikram@corivotech.example');
    assert.ok(vikramMb);

    // Weak password rejected on admin reset
    const weakReset = await fetch(`${baseUrl}/api/mailboxes/${vikramMb.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ newPassword: 'alllowercasepassword' }),
    });
    assert.equal(weakReset.status, 400);

    // Invalid org logoUrl rejected
    const badLogo = await fetch(`${baseUrl}/api/organisations/current`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ logoUrl: 'javascript:alert(1)' }),
    });
    assert.equal(badLogo.status, 400);

    // Self-suspension via admin users PATCH blocked
    const selfSuspend = await fetch(`${baseUrl}/api/admin/users/${owner.body.session.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    assert.equal(selfSuspend.status, 400);

    // CSV formula neutralization & quoted import
    const csvImport = await fetch(`${baseUrl}/api/contacts/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({
        format: 'csv',
        content: 'Full Name,Email,Phone,Company\n"=cmd|calc",formula@partner.example,+91-90000,"Acme, Inc."',
      }),
    });
    assert.equal(csvImport.status, 201);
    const csvExport = await fetch(`${baseUrl}/api/contacts/export?format=csv`, {
      headers: { Cookie: owner.cookie },
    });
    assert.equal(csvExport.status, 200);
    const csvText = await csvExport.text();
    assert.ok(csvText.includes('"\'=cmd|calc"'));
    assert.ok(csvText.includes('"Acme, Inc."'));

    // Platform operator scope enforcement
    const fullOp = await loginAs('operator@corivomail.example');
    const createReadOnlyOp = await fetch(`${baseUrl}/api/platform/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: fullOp.cookie },
      body: JSON.stringify({
        displayName: 'Audit Observer',
        email: 'readonly-op@corivomail.example',
        password: 'ReadOnlyStrong!2026',
        scope: 'HEALTH_READONLY',
      }),
    });
    assert.equal(createReadOnlyOp.status, 201);

    const readOnlyLogin = await loginAs('readonly-op@corivomail.example', 'ReadOnlyStrong!2026');
    assert.equal(readOnlyLogin.status, 200);

    const deniedMutate = await fetch(`${baseUrl}/api/platform/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: readOnlyLogin.cookie },
      body: JSON.stringify({ maxAttachmentMb: 10 }),
    });
    assert.equal(deniedMutate.status, 403);

    // Malformed JSON body returns 400
    const badJson = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": "bad',
    });
    assert.equal(badJson.status, 400);
  });
});


