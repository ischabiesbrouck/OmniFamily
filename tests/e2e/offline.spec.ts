import { type BrowserContext, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { en, onboard } from './helpers';

test.use({ locale: 'en-GB', timezoneId: 'Europe/Amsterdam' });

/** Waits until the service worker has precached everything and controls the page. */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active?.state !== 'activated') {
      await new Promise<void>((resolve) =>
        registration.active?.addEventListener('statechange', () => resolve(), { once: true }),
      );
    }
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

/** S5: once offline, every response must come from the service worker or local storage. */
function trackNetwork(context: BrowserContext) {
  const leaked: string[] = [];
  context.on('response', (response) => {
    if (!response.fromServiceWorker() && !response.url().startsWith('data:'))
      leaked.push(response.url());
  });
  const failed: string[] = [];
  context.on('requestfailed', (request) => {
    // A navigation cancels in-flight requests (net::ERR_ABORTED); they never reached the network.
    const error = request.failure()?.errorText ?? '';
    if (!error.includes('ERR_ABORTED')) failed.push(`${request.url()} ${error}`);
  });
  return { leaked, failed };
}

test('S1 + S5: every core feature works with the network disabled', async ({ page, context }) => {
  await page.goto('/onboarding');
  await waitForServiceWorker(page);
  await onboard(page, 'Lotte');

  await context.setOffline(true);
  const network = trackNetwork(context);

  // Cold start offline: the shell comes from the precache, data from IndexedDB.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello, Lotte' })).toBeVisible();

  // Calendar: create, edit, delete.
  await page.goto('/calendar?view=day&date=2026-10-24');
  await page.getByRole('button', { name: en.calendar.newEvent }).click();
  let dialog = page.getByRole('dialog', { name: en.calendar.form.newTitle });
  await dialog.getByLabel(en.calendar.form.title).fill('Offline swim');
  await dialog.getByLabel(en.calendar.form.startTime).fill('19:00');
  await dialog.getByLabel(en.calendar.form.endTime).fill('20:00');
  await dialog.getByRole('button', { name: en.common.save }).click();
  await page.getByRole('button', { name: /Offline swim/ }).click();
  dialog = page.getByRole('dialog', { name: en.calendar.form.editTitle });
  await dialog.getByLabel(en.calendar.form.title).fill('Offline swim (moved)');
  await dialog.getByRole('button', { name: en.common.save }).click();
  await expect(
    page.getByRole('button', { name: /19:00–20:00\s*Offline swim \(moved\)/ }),
  ).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: /Offline swim/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: en.calendar.form.delete }).click();
  await expect(page.getByText(en.calendar.noEvents)).toBeVisible();

  // Tasks: create, complete (ledger), delete.
  await page.getByRole('link', { name: en.nav.tasks }).click();
  await page.getByLabel(en.tasks.name, { exact: true }).fill('Empty the dishwasher');
  await page.getByLabel(en.tasks.assignee, { exact: true }).selectOption({ label: 'Lotte' });
  await page.getByRole('textbox', { name: en.tasks.points }).fill('5');
  await page.getByRole('button', { name: en.tasks.add }).click();
  await page.getByRole('checkbox', { name: 'Mark “Empty the dishwasher” done' }).check();
  await expect(page.getByText('Lotte: 5 points')).toBeVisible();
  await page.getByRole('button', { name: 'Delete “Empty the dishwasher”' }).click();
  await expect(page.getByText('Empty the dishwasher')).toBeHidden();

  // Groceries: add, tick, clear.
  await page.getByRole('link', { name: en.nav.groceries }).click();
  await page.getByLabel(en.groceries.name, { exact: true }).fill('Bread');
  await page.getByRole('button', { name: en.groceries.add }).click();
  await page.getByRole('checkbox', { name: 'Mark “Bread” bought' }).check();
  await page.getByRole('button', { name: en.groceries.clearPurchased }).click();
  await expect(page.getByText(en.groceries.empty)).toBeVisible();

  // Members: add one in Settings.
  await page.getByRole('link', { name: en.nav.settings }).click();
  await page.getByLabel(en.onboarding.memberName, { exact: true }).fill('Daan');
  await page.getByRole('button', { name: en.common.add }).click();
  await expect(page.locator('li', { hasText: 'Daan' })).toBeVisible();

  // Everything survives an offline reload.
  await page.reload();
  await expect(page.locator('li', { hasText: 'Daan' })).toBeVisible();

  // S5: nothing was answered by the network; the only failures are optional RSC fetches
  // that Next.js replaces with a precached document navigation.
  expect(network.leaked).toEqual([]);
  expect(
    network.failed.filter((entry) => !new URL(entry.split(' ')[0] ?? '').searchParams.has('_rsc')),
  ).toEqual([]);
});

test('installable: manifest, icons and a service worker controlling the start URL', async ({
  page,
  request,
}) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ start_url: '/', display: 'standalone', name: en.app.name });
  const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
  expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable']));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);

  await page.goto('/');
  await waitForServiceWorker(page);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
});
