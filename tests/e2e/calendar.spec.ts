import { expect, newAppContext, test } from './fixtures';
import { en, onboard } from './helpers';

const f = en.calendar.form;

test.use({ locale: 'en-GB', timezoneId: 'Europe/Amsterdam' });

test('acceptance: 2026-10-24 19:00 Europe/Amsterdam still renders 19:00 after the DST shift', async ({
  page,
}) => {
  await onboard(page);
  await page.goto('/calendar?view=day&date=2026-10-24');
  await expect(page.getByRole('heading', { name: 'Saturday 24 October 2026' })).toBeVisible();

  await page.getByRole('button', { name: en.calendar.newEvent }).click();
  const dialog = page.getByRole('dialog', { name: f.newTitle });
  await dialog.getByLabel(f.title).fill('Swimming');
  await dialog.getByLabel(f.startTime).fill('19:00');
  await dialog.getByLabel(f.endTime).fill('20:00');
  await expect(dialog.getByLabel(f.timeZone)).toHaveValue('Europe/Amsterdam');
  await dialog.getByLabel(f.repeat).selectOption('WEEKLY');
  await dialog.getByRole('button', { name: en.common.save }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('button', { name: /19:00–20:00\s*Swimming/ })).toBeVisible();

  // One week later the clocks have gone back (25 Oct 03:00 → 02:00): still 19:00.
  await page.getByRole('button', { name: en.calendar.views.week }).click();
  await page.getByRole('button', { name: en.calendar.next }).click();
  await page.getByRole('button', { name: /Open Saturday 31 October/ }).click();
  await expect(page.getByRole('heading', { name: 'Saturday 31 October 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: /19:00–20:00\s*Swimming/ })).toBeVisible();

  // Edit just this occurrence; the series is untouched.
  await page.getByRole('button', { name: /Swimming/ }).click();
  const edit = page.getByRole('dialog', { name: f.editTitle });
  await edit.getByLabel(f.startTime).fill('18:00');
  await edit.getByLabel(f.endTime).fill('19:00');
  await expect(edit.getByLabel(f.scope)).toHaveValue('this');
  await edit.getByRole('button', { name: en.common.save }).click();
  await expect(page.getByRole('button', { name: /18:00–19:00\s*Swimming/ })).toBeVisible();

  await page.goto('/calendar?view=day&date=2026-11-07');
  await expect(page.getByRole('button', { name: /19:00–20:00\s*Swimming/ })).toBeVisible();

  // Delete one occurrence.
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: /Swimming/ }).click();
  await page
    .getByRole('dialog', { name: f.editTitle })
    .getByRole('button', { name: f.delete })
    .click();
  await expect(page.getByText(en.calendar.noEvents)).toBeVisible();

  // The month view still shows the remaining occurrences.
  await page.goto('/calendar?view=month&date=2026-10-01');
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Swimming/ })).toHaveCount(2); // 24 and 31 Oct
});

test('an event seen from another time zone shows the converted time', async ({ browser }) => {
  const amsterdam = await newAppContext(browser, {
    locale: 'en-GB',
    timezoneId: 'Europe/Amsterdam',
  });
  const page = await amsterdam.newPage();
  await onboard(page);
  await page.goto('/calendar?view=day&date=2026-10-24');
  await page.getByRole('button', { name: en.calendar.newEvent }).click();
  const dialog = page.getByRole('dialog', { name: f.newTitle });
  await dialog.getByLabel(f.title).fill('Call grandma');
  await dialog.getByLabel(f.timeZone).selectOption('America/New_York');
  await dialog.getByLabel(f.startTime).fill('13:00');
  await dialog.getByLabel(f.endTime).fill('14:00');
  await dialog.getByRole('button', { name: en.common.save }).click();
  // 13:00 New York (EDT, UTC−4) = 19:00 Amsterdam (CEST, UTC+2)
  await expect(page.getByRole('button', { name: /19:00–20:00\s*Call grandma/ })).toBeVisible();
  await amsterdam.close();
});
