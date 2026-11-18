// Discover what controls actually exist on specific pages.
export default async function run(page, ui) {
  const out = {};
  const targets = [
    ['contacts', 'http://localhost:3000/app/contacts'],
    ['calendar', 'http://localhost:3000/app/calendar'],
    ['tasks', 'http://localhost:3000/app/tasks'],
    ['inbox', 'http://localhost:3000/app/mail/inbox'],
  ];

  // login first
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'razeen@corivotech.example');
  await page.fill('input[type="password"]', 'CorivoDev!2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app/mail/inbox', { timeout: 15000 });

  for (const [name, url] of targets) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const snap = await ui.snapshot({ full: true });
    out[name] = snap.split('\n').slice(0, 120).join('\n');
  }
  return out;
}
