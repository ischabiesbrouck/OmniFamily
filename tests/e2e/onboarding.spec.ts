import { expect, newAppContext, test } from './fixtures';
import { en } from './helpers';

test.use({ locale: 'en-US' });

test('first run: onboarding → Today, then a parent PIN gates Settings', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole('button', { name: new RegExp(en.onboarding.choose.create) }).click();
  await expect(page.getByText(en.onboarding.pinDisclosure)).toBeVisible();

  await page.getByLabel(en.onboarding.yourName).fill('Lotte');
  await page.getByRole('button', { name: en.onboarding.submit }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Hello, Lotte' })).toBeVisible();

  // The vault survives a reload: no account, nothing on a server.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Lotte' })).toBeVisible();

  await page.getByRole('link', { name: en.nav.settings }).click();
  await page.getByRole('button', { name: en.settings.setPin }).click();
  await page.getByLabel(en.settings.newPin).fill('2580');
  await page.getByRole('button', { name: en.common.save }).click();
  await expect(page.getByText(en.settings.pinSet)).toBeVisible();

  // Leaving and returning re-locks Settings behind the parent PIN.
  await page.getByRole('link', { name: en.nav.today }).click();
  await page.getByRole('link', { name: en.nav.settings }).click();
  await page.getByRole('button', { name: 'Unlock as Lotte' }).click();
  await page.getByLabel('Enter the PIN for Lotte').fill('1111');
  await page.getByRole('button', { name: en.pin.submit }).click();
  await expect(page.getByText(en.pin.wrong)).toBeVisible();
  await page.getByLabel('Enter the PIN for Lotte').fill('2580');
  await page.getByRole('button', { name: en.pin.submit }).click();
  await expect(page.getByRole('heading', { name: en.settings.members })).toBeVisible();
});

test('Dutch browsers get Dutch copy', async ({ browser }) => {
  const context = await newAppContext(browser, { locale: 'nl-NL' });
  const page = await context.newPage();
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'Welkom bij OmniFamily' })).toBeVisible();
  await page.getByRole('button', { name: /Nieuw gezin aanmaken/ }).click();
  await expect(page.getByRole('heading', { name: 'Stel je gezin in' })).toBeVisible();
  await context.close();
});
