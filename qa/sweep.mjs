// QA sweep: logs in and visits every major Corivo Mail page, recording render state.
const PAGES = [
  '/login',
  '/app/mail/inbox',
  '/app/mail/sent',
  '/app/mail/drafts',
  '/app/mail/starred',
  '/app/mail/snoozed',
  '/app/mail/archive',
  '/app/mail/spam',
  '/app/mail/trash',
  '/app/search',
  '/app/contacts',
  '/app/calendar',
  '/app/migration',
  '/app/shared-mailboxes',
  '/app/tasks',
  '/app/notes',
  '/app/account/profile',
  '/app/account/security',
  '/app/account/sessions',
  '/app/settings',
  '/app/settings/signature',
  '/app/settings/storage',
  '/onboarding/organisation',
  '/onboarding/domain',
  '/admin/overview',
  '/admin/domains',
  '/admin/domains/add',
  '/admin/mailboxes',
  '/admin/users',
  '/admin/groups',
  '/admin/roles',
  '/admin/security',
  '/admin/deliverability',
  '/admin/usage',
  '/admin/organisation',
  '/admin/audit-logs',
  '/admin/billing',
  '/admin/integrations',
  '/features',
  '/pricing',
  '/security',
  '/support',
];

export default async function run(page, ui) {
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()}`));
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/api/')) {
      failedRequests.push(`${res.status()} ${res.url().replace('http://localhost:3000', '')}`);
    }
  });

  // Log in through the real form.
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', 'razeen@corivotech.example');
  await page.fill('input[type="password"], input[name="password"]', 'CorivoDev!2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const afterLogin = page.url();

  const results = [];
  for (const path of PAGES) {
    const before = consoleErrors.length;
    const beforeFailed = failedRequests.length;
    try {
      await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(600);
      const info = await page.evaluate(() => ({
        chars: (document.body.innerText || '').length,
        heading: document.querySelector('h1, h2')?.innerText?.slice(0, 80) || '',
        buttons: document.querySelectorAll('button').length,
        links: document.querySelectorAll('a').length,
        inputs: document.querySelectorAll('input, textarea, select').length,
      }));
      results.push({
        path,
        ...info,
        newErrors: consoleErrors.length - before,
        newFailed: failedRequests.length - beforeFailed,
      });
    } catch (err) {
      results.push({ path, error: String(err).slice(0, 160) });
    }
  }

  // Also check unauthenticated access to protected routes.
  await page.context().clearCookies();
  await page.goto('http://localhost:3000/admin/overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const adminRedirect = page.url();

  return {
    afterLogin,
    adminRedirectWhenSignedOut: adminRedirect,
    results,
    consoleErrors: consoleErrors.slice(0, 30),
    failedRequests: [...new Set(failedRequests)].slice(0, 30),
  };
}
