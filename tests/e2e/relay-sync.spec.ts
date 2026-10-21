import type { Page } from '@playwright/test';
import { expect, newAppContext, test } from './fixtures';
import { en, onboard } from './helpers';

const s = en.sync;

async function addDevice(a: Page) {
  await a.getByRole('link', { name: en.nav.settings }).click();
  await a.getByRole('button', { name: s.invite.button }).click();
  await expect(a.getByRole('img', { name: s.invite.qrLabel })).toBeVisible();
  const code = (await a.locator('output').textContent()) ?? '';
  expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  const link = await a.getByLabel(s.invite.link).inputValue();
  expect(link.endsWith(`/onboarding/#join=${code}`)).toBe(true);
  return { code, link };
}

test('each device is its own person: join by QR link or typed family code, then stay in sync', async ({
  browser,
}) => {
  const options = { locale: 'en-GB', timezoneId: 'Europe/Amsterdam' };
  const a = await (await newAppContext(browser, options)).newPage();
  const b = await (await newAppContext(browser, options)).newPage();
  const c = await (await newAppContext(browser, options)).newPage();

  await onboard(a, 'Lotte');
  await a.goto('/calendar?view=day');
  await a.getByRole('button', { name: en.calendar.newEvent }).click();
  const create = a.getByRole('dialog', { name: en.calendar.form.newTitle });
  await create.getByLabel(en.calendar.form.title).fill('Swimming');
  await create.getByRole('button', { name: en.common.save }).click();
  await expect(a.getByRole('button', { name: /Swimming/ })).toBeVisible();

  // Device B opens the QR code's link: the code is filled in, one tap joins.
  const first = await addDevice(a);
  const wire: string[] = [];
  b.on('websocket', (ws) => ws.on('framesent', (f) => wire.push(String(f.payload))));
  await b.goto(first.link);
  await expect(b.getByRole('heading', { name: s.join.title })).toBeVisible();
  await expect(b).not.toHaveURL(/#join=/);
  await expect(b.getByLabel(s.join.codeLabel)).toHaveValue(first.code);
  await b.getByLabel(s.join.deviceName).fill('Daan’s phone');
  await b.getByRole('button', { name: s.join.submit }).click();

  // …and registers as a new person in the family.
  await expect(b.getByRole('radio', { name: /Lotte/ })).toBeVisible({ timeout: 20_000 });
  await b.getByRole('radio', { name: s.who.newPerson }).check();
  await b.getByLabel(s.who.name).fill('Daan');
  await b.getByRole('button', { name: s.who.submit }).click();
  await expect(b.getByRole('heading', { name: 'Hello, Daan' })).toBeVisible();
  await expect(b.getByRole('button', { name: /Swimming/ })).toBeVisible({ timeout: 20_000 });
  await expect(a.getByText('Daan’s phone has joined your family.')).toBeVisible({
    timeout: 20_000,
  });
  await a.getByRole('button', { name: s.done }).click();
  await expect(a.getByRole('switch', { name: s.online.label })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Device C types a new family code by hand (sloppily) and is an existing member.
  const second = await addDevice(a);
  await c.goto('/onboarding');
  await c.getByRole('button', { name: new RegExp(en.onboarding.choose.join) }).click();
  await c.getByLabel(s.join.codeLabel).fill(` ${second.code.toLowerCase().replace('-', ' ')} `);
  await c.getByRole('button', { name: s.join.submit }).click();
  await c.getByRole('radio', { name: /Lotte/ }).check({ timeout: 20_000 });
  await c.getByRole('button', { name: s.who.submit }).click();
  await expect(c.getByRole('heading', { name: 'Hello, Lotte' })).toBeVisible();
  // Daan, added on B, reaches C through sync.
  await expect(c.getByText('Daan', { exact: true })).toBeVisible({ timeout: 20_000 });

  // B → A, live.
  await b.getByRole('link', { name: en.nav.groceries }).click();
  await b.getByLabel(en.groceries.name, { exact: true }).fill('Goggles');
  await b.getByRole('button', { name: en.groceries.add, exact: true }).click();
  await a.getByRole('link', { name: en.nav.groceries }).click();
  await expect(a.getByText('Goggles')).toBeVisible({ timeout: 20_000 });

  // After a reload nobody scans anything again: A → B still arrives.
  await b.reload();
  await a.reload();
  await a.getByLabel(en.groceries.name, { exact: true }).fill('Towel');
  await a.getByRole('button', { name: en.groceries.add, exact: true }).click();
  await expect(b.getByText('Towel')).toBeVisible({ timeout: 20_000 });
  await expect(b.getByRole('navigation').getByText(s.relay.online)).toBeVisible();

  // Only ciphertext leaves the device.
  expect(wire.length).toBeGreaterThan(0);
  expect(wire.join('\n')).not.toMatch(/Goggles|Towel|Swimming|Lotte|Daan/);
});

test('a wrong family code says so and joins nothing', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: new RegExp(en.onboarding.choose.join) }).click();
  await page.getByLabel(s.join.codeLabel).fill('12345');
  await page.getByRole('button', { name: s.join.submit }).click();
  await expect(page.getByText(s.inviteErrors.invalid)).toBeVisible();
});
