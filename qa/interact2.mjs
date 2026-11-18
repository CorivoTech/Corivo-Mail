// Functional QA round 2 — main-content scoped, verifies create flows + compose modal contents.
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

export default async function run(page) {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'razeen@corivotech.example');
  await page.fill('input[type="password"]', 'CorivoDev!2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app/mail/inbox', { timeout: 15000 });

  const main = () => page.locator('main');

  // 1. Compose modal — inventory its capabilities
  await step('compose modal inventory', async () => {
    await page.getByRole('button', { name: 'Compose', exact: true }).first().click();
    await page.waitForTimeout(900);
    const modalText = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]') || document.body;
      return dlg.innerText;
    });
    const controls = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]') || document.body;
      return [...dlg.querySelectorAll('button, input, textarea, select, label')]
        .map((el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('title') || '').trim())
        .filter(Boolean)
        .slice(0, 60);
    });
    // close it
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    return { modalText: modalText.slice(0, 700), controls };
  });

  // 2. Create folder (sidebar)
  await step('create custom folder', async () => {
    await page.getByRole('button', { name: 'Create custom folder' }).first().click();
    await page.waitForTimeout(700);
    const input = page.locator('input[placeholder*="folder" i], input[name="name"]').first();
    await input.fill('QA Sweep Folder');
    await page.getByRole('button', { name: /^(create|save|add)/i }).last().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/QA Sweep Folder/.test(body)) throw new Error('folder not listed');
    return { folderCreated: true };
  });

  // 3. New contact
  await step('create contact', async () => {
    await page.goto('http://localhost:3000/app/contacts', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await main().getByRole('button', { name: /new contact/i }).first().click();
    await page.waitForTimeout(800);
    const fields = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]') || document.querySelector('main');
      return [...dlg.querySelectorAll('input, textarea, select')].map((el) => ({
        name: el.getAttribute('name'), ph: el.getAttribute('placeholder'), type: el.getAttribute('type'),
      }));
    });
    const dlg = page.locator('[role="dialog"]');
    const nameSel = dlg.locator('input').first();
    await nameSel.fill('QA Sweep Contact');
    const inputs = dlg.locator('input');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const t = await inputs.nth(i).getAttribute('type');
      if (t === 'email') { await inputs.nth(i).fill('qasweep@meridianbank.example'); break; }
    }
    await dlg.getByRole('button', { name: /^(save|add|create)/i }).first().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    return { fields, foundAfter: /QA Sweep Contact/.test(body) };
  });

  // 4. New calendar event
  await step('create calendar event', async () => {
    await page.goto('http://localhost:3000/app/calendar', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await main().getByRole('button', { name: /new event/i }).first().click();
    await page.waitForTimeout(800);
    const dlg = page.locator('[role="dialog"]');
    const fields = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return [];
      return [...d.querySelectorAll('input, textarea, select')].map((el) => ({
        name: el.getAttribute('name'), ph: el.getAttribute('placeholder'), type: el.getAttribute('type'),
      }));
    });
    const first = dlg.locator('input[type="text"], input:not([type])').first();
    await first.fill('QA Sweep Event');
    await dlg.getByRole('button', { name: /^(save|create|add)/i }).first().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    return { fields, foundAfter: /QA Sweep Event/.test(body) };
  });

  // 5. Add task
  await step('create task', async () => {
    await page.goto('http://localhost:3000/app/tasks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await main().getByRole('textbox', { name: /new task title/i }).first().fill('QA Sweep Task');
    await main().getByRole('button', { name: /add task/i }).first().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/QA Sweep Task/.test(body)) throw new Error('task not listed');
    return { taskCreated: true };
  });

  // 6. Admin: domain detail + DNS check
  await step('admin domain detail', async () => {
    await page.goto('http://localhost:3000/admin/domains', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.locator('main a[href*="/admin/domains/"]').first().click();
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    const buttons = await page.evaluate(() =>
      [...document.querySelectorAll('main button')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 40));
    const hasDns = /SPF|DKIM|DMARC/i.test(body);
    // try a DNS check action if present
    const checkBtn = page.locator('main').getByRole('button', { name: /run.*check|check.*record|re-check|check dns/i }).first();
    let ran = false;
    if (await checkBtn.count()) { await checkBtn.click(); await page.waitForTimeout(2500); ran = true; }
    return { url: page.url(), hasDns, buttons, checkRan: ran };
  });

  return { log, consoleErrors: [...new Set(consoleErrors)].slice(0, 20) };
}
