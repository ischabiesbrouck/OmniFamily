import { expect, type Page } from '@playwright/test';
import en from '../../lib/i18n/messages/en.json' with { type: 'json' };

export { en };

/** Runs first-run onboarding with a name (and optionally a parent PIN). */
export async function onboard(page: Page, name = 'Lotte', pin?: string): Promise<void> {
  await page.goto('/onboarding');
  await page.getByLabel(en.onboarding.yourName).fill(name);
  if (pin) await page.getByLabel(/Parent PIN/).fill(pin);
  await page.getByRole('button', { name: en.onboarding.submit }).click();
  await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();
}
