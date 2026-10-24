import { expect, newAppContext, test } from './fixtures';
import { en, onboard } from './helpers';

const h = en.help;

test('a new user finds the guide from Today, and the card stays away once seen @mobile', async ({
  page,
}) => {
  await onboard(page, 'Lotte');
  const card = page.getByRole('region', { name: h.welcome.title });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: h.welcome.open }).click();

  await expect(page.getByRole('heading', { name: h.title, level: 1 })).toBeVisible();
  // Every topic is listed and jumps to its section.
  const topics = page.getByRole('navigation', { name: h.topics });
  await expect(topics.getByRole('link')).toHaveCount(Object.keys(h.sections).length);
  await topics.getByRole('link', { name: h.sections.family.title }).click();
  await expect(page).toHaveURL(/#family$/);
  await expect(page.getByText(h.sections.family.steps[1] ?? '')).toBeVisible();

  // Questions open on tap.
  const question = h.faq.items[0];
  await page.getByText(question?.q ?? '').click();
  await expect(page.getByText(question?.a ?? '')).toBeVisible();

  await page.getByRole('link', { name: h.back }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Lotte' })).toBeVisible();
  await expect(page.getByRole('region', { name: h.welcome.title })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Lotte' })).toBeVisible();
  await expect(page.getByRole('region', { name: h.welcome.title })).toBeHidden();
});

test('the guide is in Dutch for Dutch browsers', async ({ browser }) => {
  const context = await newAppContext(browser, { locale: 'nl-NL' });
  const page = await context.newPage();
  await page.goto('/onboarding');
  await page.getByRole('button', { name: /Nieuw gezin aanmaken/ }).click();
  await page.getByLabel('Je naam').fill('Lotte');
  await page.getByRole('button', { name: 'Beginnen' }).click();
  await page.getByRole('link', { name: 'Laat zien hoe' }).click();
  await expect(page.getByRole('heading', { name: 'Uitleg', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gezin & apparaten' })).toBeVisible();
  await context.close();
});
