import type { Page } from '@playwright/test';
import { expect, newAppContext, test } from './fixtures';
import { en, onboard } from './helpers';

const s = en.sync;

async function codeFrom(page: Page): Promise<string> {
  const box = page.getByLabel(s.textCode);
  await expect(box).not.toHaveValue('', { timeout: 15_000 });
  return box.inputValue();
}

test('acceptance: device B receives device A’s vault and a subsequent edit', async ({
  browser,
}) => {
  const options = { locale: 'en-GB', timezoneId: 'Europe/Amsterdam' };
  const contextA = await newAppContext(browser, options);
  const contextB = await newAppContext(browser, options);
  const a = await contextA.newPage();
  const b = await contextB.newPage();

  // Device A: a household with an event today.
  await onboard(a, 'Lotte');
  await a.goto('/calendar?view=day');
  await a.getByRole('button', { name: en.calendar.newEvent }).click();
  const create = a.getByRole('dialog', { name: en.calendar.form.newTitle });
  await create.getByLabel(en.calendar.form.title).fill('Swimming');
  await create.getByRole('button', { name: en.common.save }).click();
  await expect(a.getByRole('button', { name: /Swimming/ })).toBeVisible();

  // A shows the offer code…
  await a.getByRole('link', { name: en.nav.settings }).click();
  await a.getByText(s.lanTitle, { exact: true }).click();
  await a.getByRole('button', { name: s.connect }).click();
  const offer = await codeFrom(a);
  expect(offer).toMatch(/^OF1\/1\/\d+\//);

  // …B (fresh: no account, no household) reads it and shows its answer…
  await b.goto('/onboarding');
  await b.getByRole('button', { name: new RegExp(en.onboarding.choose.join) }).click();
  await expect(b.getByRole('heading', { name: s.join.title })).toBeVisible();
  await b.getByLabel(s.join.deviceName).fill('Daan’s phone');
  await b.getByText(s.lanTitle, { exact: true }).click();
  await b.getByLabel(s.pasteLabel).fill(offer);
  await expect(b.getByLabel(s.join.deviceName)).toHaveValue('Daan’s phone');
  await b.getByRole('button', { name: s.useCode }).click();
  const answer = await codeFrom(b);
  const checkCode = (await b.getByText(/Check that both screens show \d{6}/).textContent()) ?? '';

  // …A reads B's answer. Both screens show the same check code.
  await a.getByLabel(s.pasteLabel).fill(answer);
  await a.getByRole('button', { name: s.useCode }).click();
  await expect(a.getByText(checkCode)).toBeVisible();

  await expect(a.getByText(en.sync.connected)).toBeVisible({ timeout: 20_000 });
  await expect(b.getByText(checkCode)).toBeVisible();
  await expect(b.getByText(en.sync.connected)).toBeVisible();
  await a.getByRole('button', { name: s.done }).click();
  // B's device belongs to a new person in the family.
  await b.getByRole('radio', { name: s.who.newPerson }).check();
  await b.getByLabel(s.who.name).fill('Daan');
  await b.getByRole('button', { name: s.who.submit }).click();

  // B received A's vault: household, members and today's event.
  await expect(b).toHaveURL(/\/$/);
  await expect(b.getByRole('main').getByText('Lotte', { exact: true })).toBeVisible();
  await expect(b.getByRole('button', { name: /Swimming/ })).toBeVisible();
  await expect(a.getByRole('navigation').getByText('Live with Daan’s phone')).toBeVisible();
  await expect(a.getByRole('main').locator('li', { hasText: 'Daan’s phone' })).toBeVisible(); // B's device record came back

  // A subsequent edit on A arrives on B over the open channel (client-side navigation only:
  // a full reload would close the DataChannel).
  await a.getByRole('link', { name: en.nav.today }).click();
  await a.getByRole('button', { name: /Swimming/ }).click();
  await a.getByRole('dialog').getByRole('button', { name: en.common.edit }).click();
  const edit = a.getByRole('dialog', { name: en.calendar.form.editTitle });
  await edit.getByLabel(en.calendar.form.title).fill('Swimming lesson');
  await edit.getByRole('button', { name: en.common.save }).click();
  await expect(b.getByRole('button', { name: /Swimming lesson/ })).toBeVisible();

  // …and B's edits travel back to A.
  await b.getByRole('link', { name: en.nav.groceries }).click();
  await b.getByLabel(en.groceries.name, { exact: true }).fill('Goggles');
  await b.getByRole('button', { name: en.groceries.add, exact: true }).click();
  await a.getByRole('link', { name: en.nav.groceries }).click();
  await expect(a.getByText('Goggles')).toBeVisible();

  await contextA.close();
  await contextB.close();
});
