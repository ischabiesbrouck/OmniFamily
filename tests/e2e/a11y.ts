import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.2 A/AA plus the AAA contrast rule (7:1, SPEC §6). */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'wcag2aaa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `axe violations on ${label}`).toEqual([]);
}

/** Every visible interactive target is at least 48 × 48 CSS px (SPEC §6). */
export async function expectLargeTargets(page: Page, label: string): Promise<void> {
  const small = await page.evaluate(() => {
    const targets = document.querySelectorAll<HTMLElement>(
      'button, a[href], select, input:not([type=checkbox]):not([type=radio]), label:has(> input[type=checkbox]), label:has(> input[type=radio])',
    );
    return [...targets]
      .filter((el) => el.offsetParent !== null && !el.closest('.sr-only'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 47.5 || r.height < 47.5)
      .map(
        ({ el, r }) =>
          `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
      );
  });
  expect(small, `targets under 48 px on ${label}`).toEqual([]);
}
