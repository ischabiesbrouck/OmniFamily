import { expect, type Page } from '@playwright/test';
import en from '../../lib/i18n/messages/en.json' with { type: 'json' };

export { en };

/** Runs first-run onboarding with just a name. */
export async function onboard(page: Page, name = 'Lotte'): Promise<void> {
  await page.goto('/onboarding');
  await page.getByLabel(en.onboarding.yourName).fill(name);
  await page.getByRole('button', { name: en.onboarding.submit }).click();
  await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();
}
