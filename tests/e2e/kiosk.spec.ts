import { expect, test } from './fixtures';
import { en, onboard } from './helpers';

test.use({ locale: 'en-GB', timezoneId: 'Europe/Amsterdam' });

test('kiosk: chores can be ticked by anyone; leaving needs the parent PIN', async ({ page }) => {
  await onboard(page, 'Lotte', '2580');

  await page.goto('/tasks');
  await page.getByLabel(en.tasks.name, { exact: true }).fill('Water the plants');
  await page.getByLabel(en.tasks.assignee, { exact: true }).selectOption({ label: 'Lotte' });
  await page.getByRole('textbox', { name: en.tasks.points }).fill('3');
  await page.getByRole('button', { name: en.tasks.add }).click();
  // Navigating before the IndexedDB write commits would abort it; wait for it to land.
  await expect(page.getByText('Water the plants')).toBeVisible();

  await page.goto('/kiosk');
  await expect(page.getByRole('heading', { name: en.kiosk.chores })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0); // own layout, no app chrome
  await page.getByRole('checkbox', { name: 'Mark “Water the plants” done' }).check();
  await expect(page.getByText(en.kiosk.noChores)).toBeVisible();
  await expect(page.getByText('Lotte: 3 points')).toBeVisible();
  await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0);

  await page.getByRole('button', { name: en.kiosk.exit }).click();
  await page.getByRole('button', { name: 'Unlock as Lotte' }).click();
  await page.getByLabel('Enter the PIN for Lotte').fill('0000');
  await page.getByRole('button', { name: en.pin.submit }).click();
  await expect(page.getByText(en.pin.wrong)).toBeVisible();
  await expect(page).toHaveURL(/\/kiosk$/);
  await page.getByLabel('Enter the PIN for Lotte').fill('2580');
  await page.getByRole('button', { name: en.pin.submit }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('kiosk: wake lock is re-acquired, the layout shifts against burn-in, idle resets the view', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const requests: string[] = [];
    Object.assign(window, { __wakeLockRequests: requests });
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async (type: string) => {
          requests.push(type);
          const sentinel = new EventTarget() as EventTarget & {
            released: boolean;
            release(): Promise<void>;
          };
          sentinel.released = false;
          sentinel.release = async () => {
            sentinel.released = true;
          };
          Object.assign(window, { __lastSentinel: sentinel });
          return sentinel;
        },
      },
    });
  });
  await page.clock.install({ time: new Date('2026-10-24T08:00:00+02:00') });
  await onboard(page, 'Lotte', '2580');
  await page.goto('/kiosk');
  await expect(page.getByRole('heading', { name: en.kiosk.chores })).toBeVisible();
  await expect(page.getByText('08:00')).toBeVisible();

  const wakeLocks = () =>
    page.evaluate(() => (window as unknown as { __wakeLockRequests: string[] }).__wakeLockRequests);
  await expect.poll(wakeLocks).toEqual(['screen']);
  // The OS drops the lock when the tab is hidden; on return it must be requested again.
  await page.evaluate(() => {
    (window as unknown as { __lastSentinel: { released: boolean } }).__lastSentinel.released = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(wakeLocks).toEqual(['screen', 'screen']);

  const main = page.getByRole('main');
  await expect(main).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.clock.runFor(5 * 60_000);
  await expect(main).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 1, 0)');
  await expect(page.getByText('08:05')).toBeVisible(); // minute clock advanced too

  await page.getByRole('button', { name: en.kiosk.exit }).click();
  await expect(page.getByRole('button', { name: 'Unlock as Lotte' })).toBeVisible();
  await page.clock.runFor(30_000);
  await expect(page.getByRole('button', { name: 'Unlock as Lotte' })).toBeVisible(); // not idle yet
  await page.clock.runFor(31_000);
  await expect(page.getByRole('button', { name: 'Unlock as Lotte' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: en.kiosk.exit })).toBeVisible();
});
