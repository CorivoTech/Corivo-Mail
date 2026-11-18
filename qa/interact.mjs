// Functional QA: drive real user flows and report what actually worked.
const log = [];
const consoleErrors = [];

async function step(name, fn) {
  try {
    const detail = await fn();
    log.push({ step: name, ok: true, ...(detail || {}) });
  } catch (err) {
    log.push({ step: name, ok: false, error: String(err).slice(0, 220) });
  }
}

export default async function run(page, ui) {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
  });

  // ---- Login ----
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', 'razeen@corivotech.example');
  await page.fill('input[type="password"], input[name="password"]', 'CorivoDev!2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app/mail/inbox', { timeout: 15000 });

  // ---- 1. Open a message from the list ----
  await step('open message thread', async () => {
    const rows = page.locator('[data-testid="message-row"], li, tr');
    const first = page.getByText('Enterprise Email Onboarding', { exact: false }).first();
    await first.click({ timeout: 8000 });
    await page.waitForTimeout(1200);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/IT committee reviewed/i.test(body)) throw new Error('message body did not open');
    return { opened: true };
  });

  // ---- 2. Compose + send ----
  await step('compose and send mail', async () => {
    const composeBtn = page.getByRole('button', { name: /compose|new mail|write/i }).first();
    await composeBtn.click({ timeout: 8000 });
    await page.waitForTimeout(800);
    const toSel = page.locator('input[name="to"], input[placeholder*="recipient" i], input[placeholder*="To" i]').first();
    await toSel.fill('ananya@corivotech.example', { timeout: 8000 });
    const subjectSel = page.locator('input[name="subject"], input[placeholder*="Subject" i]').first();
    await subjectSel.fill('QA Sweep — automated functional check');
    const bodySel = page.locator('textarea, div[contenteditable="true"]').first();
    await bodySel.fill('Automated QA body: verifying outbound send pipeline.');
    await page.waitForTimeout(300);
    const sendBtn = page.getByRole('button', { name: /^send/i }).first();
    await sendBtn.click({ timeout: 8000 });
    await page.waitForTimeout(2500);

    // Verify it landed in Sent
    await page.goto('http://localhost:3000/app/mail/sent', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/QA Sweep — automated functional check/.test(body)) {
      throw new Error('sent message not visible in Sent folder');
    }
    return { deliveredToSent: true };
  });

  // ---- 3. Create a custom folder ----
  await step('create custom folder', async () => {
    await page.goto('http://localhost:3000/app/mail/inbox', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const btn = page.getByRole('button', { name: /new folder|create folder|add folder|\+/i }).first();
    await btn.click({ timeout: 6000 });
    await page.waitForTimeout(600);
    const input = page.locator('input[placeholder*="folder" i], input[name="name"]').first();
    await input.fill('QA Sweep Folder');
    await page.getByRole('button', { name: /create|save|add/i }).first().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/QA Sweep Folder/.test(body)) throw new Error('folder not listed after creation');
    return { folderCreated: true };
  });

  // ---- 4. Domain DNS check (admin) ----
  await step('admin: run DNS check', async () => {
    await page.goto('http://localhost:3000/admin/domains', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const checkBtn = page.getByRole('button', { name: /check|verify|dns/i }).first();
    await checkBtn.click({ timeout: 8000 });
    await page.waitForTimeout(2500);
    const body = await page.evaluate(() => document.body.innerText);
    return { pageText: body.slice(0, 300) };
  });

  // ---- 5. Add a contact ----
  await step('create contact', async () => {
    await page.goto('http://localhost:3000/app/contacts', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const addBtn = page.getByRole('button', { name: /add|new contact|create/i }).first();
    await addBtn.click({ timeout: 8000 });
    await page.waitForTimeout(700);
    const nameInput = page.locator('input[name="fullName"], input[placeholder*="name" i]').first();
    await nameInput.fill('QA Sweep Contact');
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    await emailInput.fill('qasweep@meridianbank.example');
    await page.getByRole('button', { name: /save|add|create/i }).first().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/QA Sweep Contact/.test(body)) throw new Error('contact not listed after creation');
    return { contactCreated: true };
  });

  // ---- 6. Create calendar event ----
  await step('create calendar event', async () => {
    await page.goto('http://localhost:3000/app/calendar', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const addBtn = page.getByRole('button', { name: /new event|add event|create/i }).first();
    await addBtn.click({ timeout: 8000 });
    await page.waitForTimeout(700);
    const title = page.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="event" i]').first();
    await title.fill('QA Sweep Review');
    await page.getByRole('button', { name: /save|create|add/i }).first().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/QA Sweep Review/.test(body)) throw new Error('event not listed after creation');
    return { eventCreated: true };
  });

  // ---- 7. Create a task ----
  await step('create task', async () => {
    await page.goto('http://localhost:3000/app/tasks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const addBtn = page.getByRole('button', { name: /new task|add|create/i }).first();
    await addBtn.click({ timeout: 8000 });
    await page.waitForTimeout(700);
    const input = page.locator('input[name="title"], input[placeholder*="task" i]').first();
    await input.fill('QA Sweep Task');
    await page.getByRole('button', { name: /save|create|add/i }).first().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/QA Sweep Task/.test(body)) throw new Error('task not listed after creation');
    return { taskCreated: true };
  });

  // ---- 8. Search ----
  await step('search mail', async () => {
    await page.goto('http://localhost:3000/app/search', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const input = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await input.fill('GST');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    const body = await page.evaluate(() => document.body.innerText);
    return { hasResults: /GST/i.test(body) };
  });

  return { log, consoleErrors: consoleErrors.slice(0, 20) };
}
