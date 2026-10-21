import { expect, test } from './fixtures';
import { expectAccessible, expectLargeTargets } from './a11y';
import { en, onboard } from './helpers';

test.use({ locale: 'en-GB', timezoneId: 'Europe/Amsterdam' });

test('every screen passes axe (WCAG 2.2 AA + AAA contrast) with large enough targets @mobile', async ({
  page,
}) => {
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: en.onboarding.choose.title })).toBeVisible();
  await expectAccessible(page, 'welcome');
  await expectLargeTargets(page, 'welcome');
  await page.getByRole('button', { name: new RegExp(en.onboarding.choose.join) }).click();
  await expect(page.getByRole('heading', { name: en.sync.join.title })).toBeVisible();
  await expectAccessible(page, 'join');
  await expectLargeTargets(page, 'join');
  await page.getByRole('button', { name: en.sync.join.back }).click();
  await page.getByRole('button', { name: new RegExp(en.onboarding.choose.create) }).click();
  await expect(page.getByRole('heading', { name: en.onboarding.title })).toBeVisible();
  await expectAccessible(page, 'onboarding');
  await expectLargeTargets(page, 'onboarding');

  await onboard(page, 'Lotte');

  // Seed one of everything so lists, chips and badges are audited too.
  await page.goto('/calendar?view=day&date=2026-10-24');
  await page.getByRole('button', { name: en.calendar.newEvent }).click();
  const dialog = page.getByRole('dialog', { name: en.calendar.form.newTitle });
  await dialog.getByLabel(en.calendar.form.title).fill('Swimming');
  await expectAccessible(page, 'event dialog');
  await dialog.getByRole('button', { name: en.common.save }).click();
  await expect(page.getByRole('button', { name: /Swimming/ })).toBeVisible();
  await page.goto('/tasks');
  await page.getByLabel(en.tasks.name, { exact: true }).fill('Feed the cat');
  await page.getByRole('textbox', { name: en.tasks.points }).fill('2');
  await page.getByRole('button', { name: en.tasks.add }).click();
  await expect(page.getByText('Feed the cat')).toBeVisible();
  await page.goto('/groceries');
  await page.getByLabel(en.groceries.name, { exact: true }).fill('Milk');
  await page.getByRole('button', { name: en.groceries.add, exact: true }).click();
  await expect(page.getByText('Milk')).toBeVisible();

  for (const [url, ready] of [
    ['/', 'Hello, Lotte'],
    ['/calendar?view=month&date=2026-10-01', 'October 2026'],
    ['/calendar?view=week&date=2026-10-24', '19 Oct – 25 Oct 2026'],
    ['/calendar?view=day&date=2026-10-24', 'Saturday 24 October 2026'],
    ['/tasks', en.tasks.title],
    ['/groceries', en.groceries.title],
    ['/settings', en.settings.title],
  ] as const) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: ready, level: 1 })).toBeVisible();
    await expectAccessible(page, url);
    await expectLargeTargets(page, url);
  }

  await page.goto('/kiosk');
  await expect(page.getByRole('heading', { name: en.kiosk.chores })).toBeVisible();
  await expectAccessible(page, 'kiosk');
  await expectLargeTargets(page, 'kiosk', true);
});
