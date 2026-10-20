import { expect, newAppContext, test } from './fixtures';
import { en, onboard } from './helpers';

const s = en.sync;

test('one scan: a new device joins over the internet and keeps syncing after reloads', async ({
  browser,
}) => {
  const options = { locale: 'en-GB', timezoneId: 'Europe/Amsterdam' };
  const a = await (await newAppContext(browser, options)).newPage();
  const b = await (await newAppContext(browser, options)).newPage();

  await onboard(a, 'Lotte');
  await a.goto('/calendar?view=day');
  await a.getByRole('button', { name: en.calendar.newEvent }).click();
  const create = a.getByRole('dialog', { name: en.calendar.form.newTitle });
  await create.getByLabel(en.calendar.form.title).fill('Swimming');
  await create.getByRole('button', { name: en.common.save }).click();
  await expect(a.getByRole('button', { name: /Swimming/ })).toBeVisible();

  // Device A: "Add a device" shows a QR code and the same invite as a link.
  await a.getByRole('link', { name: en.nav.settings }).click();
  await a.getByRole('button', { name: s.invite.button }).click();
  await expect(a.getByRole('img', { name: s.invite.qrLabel })).toBeVisible();
  const link = await a.getByLabel(s.invite.link).inputValue();
  expect(link).toMatch(/\/onboarding\/#join=[A-Za-z0-9_-]{22}$/);

  // Device B opens the link: one tap to join, no code to send back.
  const wire: string[] = [];
  b.on('websocket', (ws) => ws.on('framesent', (f) => wire.push(String(f.payload))));
  await b.goto(link);
  await expect(b.getByRole('heading', { name: s.join.title })).toBeVisible();
  await expect(b).not.toHaveURL(/#join=/);
  await b.getByLabel(s.join.deviceName).fill('Daan’s phone');
  await b.getByRole('button', { name: s.join.submit }).click();
  await expect(b.getByText(s.join.joined)).toBeVisible({ timeout: 20_000 });
  await b.getByRole('button', { name: s.continue }).click();
  await expect(b.getByRole('button', { name: /Swimming/ })).toBeVisible({ timeout: 20_000 });
  await expect(a.getByText('Daan’s phone has joined your family.')).toBeVisible({
    timeout: 20_000,
  });
  await a.getByRole('button', { name: s.done }).click();
  await expect(a.getByRole('switch', { name: s.online.label })).toHaveAttribute(
    'aria-checked',
    'true',
  );

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
  expect(wire.join('\n')).not.toMatch(/Goggles|Towel|Swimming|Lotte/);
});
