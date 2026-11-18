// Isolated checks: folder creation from a clean page, and calendar event dialog anatomy.
const out = {};

export default async function run(page) {
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'razeen@corivotech.example');
  await page.fill('input[type="password"]', 'CorivoDev!2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app/mail/inbox', { timeout: 15000 });
  await page.waitForTimeout(1200);

  // --- Folder creation, clean state ---
  try {
    const btn = page.getByRole('button', { name: 'Create custom folder' }).first();
    await btn.click({ timeout: 8000 });
    await page.waitForTimeout(700);
    const dialogButtons = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d ? [...d.querySelectorAll('button')].map((b) => b.innerText.trim() || b.getAttribute('aria-label') || b.title) : null;
    });
    out.folderDialogButtons = dialogButtons;
    const input = page.locator('[role="dialog"] input, [role="dialog"] textarea').first();
    await input.fill('QA Sweep Folder');
    const save = page.locator('[role="dialog"] button').last();
    await save.click({ timeout: 6000 });
    await page.waitForTimeout(1800);
    const body = await page.evaluate(() => document.body.innerText);
    out.folderCreated = /QA Sweep Folder/.test(body);
    out.folderAfterText = body.slice(body.indexOf('Folders'), body.indexOf('Folders') + 220);
  } catch (err) {
    out.folderError = String(err).slice(0, 200);
  }

  // --- Calendar event dialog anatomy ---
  try {
    await page.goto('http://localhost:3000/app/calendar', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.locator('main').getByRole('button', { name: /new event/i }).first().click({ timeout: 8000 });
    await page.waitForTimeout(900);
    out.calendarDialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return { present: false, bodyHasNewEvent: document.body.innerText.includes('New Event') };
      return {
        present: true,
        buttons: [...d.querySelectorAll('button')].map((b) => b.innerText.trim() || b.getAttribute('aria-label') || b.title),
        fields: [...d.querySelectorAll('input, textarea, select')].map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type'),
          label: el.closest('label')?.innerText?.slice(0, 40) || el.getAttribute('aria-label') || '',
        })),
      };
    });

    // Fill by label order: first text-ish input is the title
    const dlg = page.locator('[role="dialog"]');
    const title = dlg.locator('input[type="text"]').first();
    if (await title.count()) {
      await title.fill('QA Sweep Event');
      const buttons = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return [...d.querySelectorAll('button')].map((b) => ({ t: b.innerText.trim(), disabled: b.disabled }));
      });
      out.calendarButtonsState = buttons;
      const saveBtn = dlg.locator('button:not([disabled])').last();
      await saveBtn.click({ timeout: 6000 });
      await page.waitForTimeout(1800);
      const body = await page.evaluate(() => document.body.innerText);
      out.calendarCreated = /QA Sweep Event/.test(body);
    } else {
      out.calendarError = 'no text input in dialog';
    }
  } catch (err) {
    out.calendarError = String(err).slice(0, 220);
  }

  return out;
}
