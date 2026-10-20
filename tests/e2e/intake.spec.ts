import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { en, onboard } from './helpers';

const t = en.intake;
test.use({ locale: 'en-GB', timezoneId: 'Europe/Amsterdam' });

async function quickAdd(page: Page, text: string) {
  await page.getByLabel(t.label, { exact: true }).fill(text);
  await page.getByRole('button', { name: t.submit }).click();
}

test('acceptance: with /api/intake answering 503, every other feature still works', async ({
  page,
}) => {
  await onboard(page, 'Lotte');
  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/intake')) sent.push(r.postData() ?? '');
  });

  // The real route: no provider is configured in v1, so it answers 503.
  await page.goto('/calendar?view=day&date=2026-10-24');
  await quickAdd(page, 'Swimming Saturday 10:00 for Lotte');
  await expect(page.getByRole('dialog', { name: t.consent.title })).toBeVisible();
  await page.getByRole('button', { name: t.consent.allow }).click();
  await expect(page.getByText(t.unavailable)).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toContain('for P1');
  expect(sent[0]).not.toContain('Lotte'); // §7.2 data minimisation

  // Everything else works: events, tasks + points, groceries, members.
  await page.getByRole('button', { name: en.calendar.newEvent }).click();
  const dialog = page.getByRole('dialog', { name: en.calendar.form.newTitle });
  await dialog.getByLabel(en.calendar.form.title).fill('Swimming');
  await dialog.getByLabel(en.calendar.form.startTime).fill('10:00');
  await dialog.getByLabel(en.calendar.form.endTime).fill('11:00');
  await dialog.getByRole('button', { name: en.common.save }).click();
  await expect(page.getByRole('button', { name: /10:00–11:00\s*Swimming/ })).toBeVisible();

  await page.getByRole('link', { name: en.nav.tasks }).click();
  await page.getByLabel(en.tasks.name, { exact: true }).fill('Pack the bag');
  await page.getByLabel(en.tasks.assignee, { exact: true }).selectOption({ label: 'Lotte' });
  await page.getByRole('textbox', { name: en.tasks.points }).fill('2');
  await page.getByRole('button', { name: en.tasks.add }).click();
  await page.getByRole('checkbox', { name: 'Mark “Pack the bag” done' }).check();
  await expect(page.getByText('Lotte: 2 points')).toBeVisible();

  await page.getByRole('link', { name: en.nav.groceries }).click();
  await page.getByLabel(en.groceries.name, { exact: true }).fill('Goggles');
  await page.getByRole('button', { name: en.groceries.add, exact: true }).click();
  await expect(page.getByText('Goggles')).toBeVisible();

  await page.getByRole('link', { name: en.nav.settings }).click();
  await page.getByLabel(en.onboarding.memberName, { exact: true }).fill('Daan');
  await page.getByRole('button', { name: en.common.add, exact: true }).click();
  await expect(page.locator('li', { hasText: 'Daan' })).toBeVisible();
});

test('declining consent sends nothing; consent can be withdrawn', async ({ page }) => {
  await onboard(page, 'Lotte');
  let calls = 0;
  await page.route('**/api/intake', (route) => {
    calls += 1;
    return route.fulfill({ status: 503, body: '{}' });
  });
  await page.goto('/calendar?view=day&date=2026-10-24');
  await quickAdd(page, 'Dentist Monday 9:00');
  await page.getByRole('button', { name: t.consent.decline }).click();
  await expect(page.getByText(t.declined)).toBeVisible();
  expect(calls).toBe(0);

  await quickAdd(page, 'Dentist Monday 9:00');
  await page.getByRole('button', { name: t.consent.allow }).click();
  await expect(page.getByText(t.unavailable)).toBeVisible();
  expect(calls).toBe(1);

  // Asked once: the next call goes straight through.
  await quickAdd(page, 'Dentist Tuesday 9:00');
  await expect.poll(() => calls).toBe(2);
  await expect(page.getByRole('dialog', { name: t.consent.title })).toHaveCount(0);

  // Withdraw in Settings → asked again.
  await page.getByRole('link', { name: en.nav.settings }).click();
  await page.getByRole('button', { name: en.privacy.withdraw }).click();
  await expect(page.getByText(en.privacy.consentNone)).toBeVisible();
  await page.getByRole('link', { name: en.nav.calendar }).click();
  await quickAdd(page, 'Dentist Wednesday 9:00');
  await expect(page.getByRole('dialog', { name: t.consent.title })).toBeVisible();
});

test('a parsed entry is reviewed, names restored locally, then saved with its linked items', async ({
  page,
}) => {
  await onboard(page, 'Lotte');
  await page.route('**/api/intake', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    expect(body.text).toBe('Swimming Saturday 10:00 for P1');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Swimming with P1',
        startInstant: '2026-10-24T08:00:00.000Z',
        endInstant: '2026-10-24T09:00:00.000Z',
        timeZone: 'Europe/Amsterdam',
        isAllDay: false,
        assigneeIds: ['P1'],
        confidenceScore: 0.92,
        linkedTasks: [{ title: 'Pack towel for P1', assigneeId: 'P1' }],
        linkedGroceries: [{ item: 'Goggles', category: 'Other' }],
      }),
    });
  });
  await page.goto('/calendar?view=day&date=2026-10-24');
  await quickAdd(page, 'Swimming Saturday 10:00 for Lotte');
  await page.getByRole('button', { name: t.consent.allow }).click();

  await expect(page.getByText('Swimming with Lotte')).toBeVisible();
  await expect(page.getByText(`${t.who}: Lotte`)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Pack towel for Lotte' })).toBeChecked();
  await page.getByRole('button', { name: t.add }).click();
  await expect(page.getByText(t.added)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /10:00–11:00\s*Swimming with Lotte/ }),
  ).toContainText('0/1');

  await page.getByRole('link', { name: en.nav.groceries }).click();
  await expect(page.getByText('Goggles')).toBeVisible();
});

test('export vault downloads JSON without secrets; delete everything erases the device', async ({
  page,
}) => {
  await onboard(page, 'Lotte', '2580');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Unlock as Lotte' }).click();
  await page.getByLabel('Enter the PIN for Lotte').fill('2580');
  await page.getByRole('button', { name: en.pin.submit }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: en.privacy.export }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^omnifamily-vault-\d{4}-\d{2}-\d{2}\.json$/);
  const stream = await download.createReadStream();
  let json = '';
  for await (const chunk of stream) json += String(chunk);
  const vault = JSON.parse(json);
  expect(vault.members.map((m: { name: string }) => m.name)).toEqual(['Lotte']);
  expect(json).not.toMatch(/pinHash|pinSalt|pbkdf2|privateKey|householdKey/);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: en.privacy.delete }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: en.onboarding.title })).toBeVisible();
  // The reloaded app reinstalls its (data-free) offline cache, so check for family data instead.
  const leftovers = await page.evaluate(
    () =>
      new Promise<Record<string, number | string | null>>((resolve, reject) => {
        const request = indexedDB.open('omnifamily-nexus');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const stores = ['members', 'events', 'tasks', 'household', 'settings'].filter((s) =>
            db.objectStoreNames.contains(s),
          );
          const counts: Record<string, number | string | null> = {
            device: localStorage.getItem('omnifamily-device'),
          };
          if (stores.length === 0) return resolve(counts);
          const tx = db.transaction(stores);
          for (const s of stores) {
            const c = tx.objectStore(s).count();
            c.onsuccess = () => (counts[s] = c.result);
          }
          tx.oncomplete = () => resolve(counts);
        };
      }),
  );
  expect(leftovers.members ?? 0).toBe(0);
  expect(leftovers.events ?? 0).toBe(0);
  expect(leftovers.household ?? 0).toBe(0);
  expect(leftovers.settings ?? 0).toBe(0); // keys, PIN counters, consent
  expect(String(leftovers.device ?? '')).not.toContain('"activeMemberId":"');
});
