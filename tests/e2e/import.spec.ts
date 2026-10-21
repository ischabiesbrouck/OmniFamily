import { expect, test } from './fixtures';
import { buildXlsx } from './files';
import { en, onboard } from './helpers';

const t = en.import;
test.use({ locale: 'en-GB', timezoneId: 'Europe/Amsterdam' });

async function openImport(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: en.add.title }).click();
  await page.getByRole('button', { name: new RegExp(en.add.import) }).click();
  return page.getByRole('dialog', { name: t.title });
}

test('pasted message → reviewed → events in the calendar, nothing sent anywhere @mobile', async ({
  page,
}) => {
  await onboard(page, 'Lotte');
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  const dialog = await openImport(page);
  await dialog
    .getByLabel(t.textLabel)
    .fill(
      [
        'Hi all, the plan:',
        'Swimming Saturday 24 October 10:00-11:00 for Lotte',
        'School trip 12 November',
        'See you!',
      ].join('\n'),
    );
  await dialog.getByRole('button', { name: t.find }).click();
  await expect(dialog.getByText('2 dates found')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: en.calendar.form.title }).first()).toHaveValue(
    'Swimming',
  );
  await expect(dialog.getByRole('button', { name: 'Lotte', pressed: true })).toBeVisible();

  await dialog.getByRole('checkbox', { name: 'Add “School trip”' }).uncheck();
  await dialog.getByRole('button', { name: 'Add 1 event' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('1 event added')).toBeVisible();

  await page.goto('/calendar?view=day&date=2026-10-24');
  await expect(page.getByRole('button', { name: /10:00–11:00\s*Swimming/ })).toBeVisible();
  expect(requests.filter((u) => !u.startsWith('http://localhost:3000/'))).toEqual([]);
});

test('spreadsheet (.xlsx) with Dutch headers', async ({ page }) => {
  await onboard(page, 'Lotte');
  const dialog = await openImport(page);
  await dialog.getByRole('tab', { name: t.tabs.file }).click();
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'schoolkalender.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buildXlsx([
      ['Datum', 'Tijd', 'Wat'],
      [46_319, '19:00 - 20:30', 'Ouderavond'], // 24-10-2026 as an Excel serial
      ['31-10-2026', '', 'Halloween'],
    ]),
  });
  await expect(dialog.getByText('2 dates found')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add 2 events' }).click();
  await expect(page.getByText('2 events added')).toBeVisible();
  await page.goto('/calendar?view=day&date=2026-10-24');
  await expect(page.getByRole('button', { name: /19:00–20:30\s*Ouderavond/ })).toBeVisible();
  await page.goto('/calendar?view=day&date=2026-10-31');
  await expect(page.getByRole('button', { name: /All day\s*Halloween/ })).toBeVisible();
});

test('photo of a letter → on-device OCR (self-hosted engine) → event', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  // Render a "letter" to a PNG, as a phone photo or screenshot would be.
  const painter = await browser.newPage({ viewport: { width: 900, height: 260 } });
  await painter.setContent(
    `<body style="margin:0;background:#fff"><p style="font:600 44px Arial;padding:40px;color:#111">Swimming lesson Saturday 24 October 2026 at 10:00</p></body>`,
  );
  const image = await painter.screenshot();
  await painter.close();

  await onboard(page, 'Lotte');
  const ocrRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/ocr/') || r.url().includes('tesseract')) ocrRequests.push(r.url());
  });
  const dialog = await openImport(page);
  await dialog.getByRole('tab', { name: t.tabs.photo }).click();
  await dialog
    .getByLabel(t.choosePhoto)
    .setInputFiles({ name: 'letter.png', mimeType: 'image/png', buffer: image });

  await expect(dialog.getByLabel(t.recognised)).toHaveValue(/Swimming lesson/i, {
    timeout: 150_000,
  });
  await expect(dialog.getByText('1 date found')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add 1 event' }).click();
  // Navigating away before the write commits would abort it (D-7.8).
  await expect(page.getByText('1 event added')).toBeVisible();
  await page.goto('/calendar?view=day&date=2026-10-24');
  await expect(page.getByRole('button', { name: /10:00–11:00\s*Swimming lesson/ })).toBeVisible();
  // Engine and language data came from this app's own origin, never a CDN.
  expect(ocrRequests.length).toBeGreaterThan(0);
  expect(ocrRequests.every((u) => u.startsWith('http://localhost:3000/ocr/'))).toBe(true);
});
