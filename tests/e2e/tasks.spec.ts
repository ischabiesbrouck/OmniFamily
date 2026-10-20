import { expect, test } from './fixtures';
import { en, onboard } from './helpers';

test.use({ locale: 'en-GB', timezoneId: 'Europe/Amsterdam' });

test('acceptance: completing a linked task writes a ledger entry and updates the event badge', async ({
  page,
}) => {
  await onboard(page, 'Lotte');

  // An event with a linked chore worth 10 points.
  await page.goto('/calendar?view=day&date=2026-10-31');
  await page.getByRole('button', { name: en.calendar.newEvent }).click();
  const create = page.getByRole('dialog', { name: en.calendar.form.newTitle });
  await create.getByLabel(en.calendar.form.title).fill('Birthday party');
  await create.getByRole('button', { name: en.common.save }).click();

  await page.getByRole('button', { name: /Birthday party/ }).click();
  const dialog = page.getByRole('dialog', { name: en.calendar.form.editTitle });
  await dialog.getByLabel(en.tasks.name).fill('Wrap the present');
  await dialog.getByLabel(en.tasks.assignee).selectOption({ label: 'Lotte' });
  await dialog.getByLabel(en.tasks.points).fill('10');
  await dialog.getByRole('button', { name: en.tasks.add }).click();
  await expect(dialog.getByText('Wrap the present')).toBeVisible();
  await dialog.getByRole('button', { name: en.common.cancel }).click();

  const chip = page.getByRole('button', { name: /Birthday party/ });
  await expect(chip).toContainText('0/1');

  // Complete it from the Tasks page.
  await page.getByRole('link', { name: en.nav.tasks }).click();
  await expect(page.getByText('Lotte: 0 points')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mark “Wrap the present” done' }).check();
  await expect(page.getByText('Lotte: 10 points')).toBeVisible();

  await page.goto('/calendar?view=day&date=2026-10-31');
  await expect(page.getByRole('button', { name: /Birthday party/ })).toContainText('1/1');

  // Reopening reverses the points through a compensating ledger entry.
  await page.goto('/tasks');
  await page.getByRole('checkbox', { name: 'Mark “Wrap the present” not done' }).uncheck();
  await expect(page.getByText('Lotte: 0 points')).toBeVisible();
});

test('grocery list: add by aisle, tick off, clear', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: en.nav.groceries }).click();
  await expect(page.getByText(en.groceries.empty)).toBeVisible();

  await page.getByLabel(en.groceries.name).fill('Milk');
  await page.getByLabel(en.groceries.quantity).fill('2 L');
  await page.getByLabel(en.groceries.category).selectOption('Dairy');
  await page.getByRole('button', { name: en.groceries.add, exact: true }).click();
  await page.getByLabel(en.groceries.name).fill('Apples');
  await page.getByLabel(en.groceries.category).selectOption('Produce');
  await page.getByRole('button', { name: en.groceries.add, exact: true }).click();

  await expect(page.getByRole('heading', { name: en.groceries.categories.Produce })).toBeVisible();
  await expect(page.getByRole('heading', { name: en.groceries.categories.Dairy })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Mark “Milk” bought' }).check();
  await page.getByRole('button', { name: en.groceries.clearPurchased }).click();
  await expect(page.getByText('Milk')).toBeHidden();
  await expect(page.getByText('Apples')).toBeVisible();
});
