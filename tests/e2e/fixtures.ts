import {
  test as base,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';

/**
 * Pages here are static HTML hydrated by React. Interacting before hydration races React's
 * event replay, so every goto/reload waits until the app marks <html data-hydrated>.
 */
function waitForHydration(page: Page): Promise<unknown> {
  return page.waitForSelector('html[data-hydrated="true"]', { state: 'attached' });
}

function patch(page: Page): void {
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  page.goto = async (...args) => {
    const response = await goto(...args);
    await waitForHydration(page);
    return response;
  };
  page.reload = async (...args) => {
    const response = await reload(...args);
    await waitForHydration(page);
    return response;
  };
}

function hydrating(context: BrowserContext): BrowserContext {
  context.pages().forEach(patch);
  context.on('page', patch);
  return context;
}

/** For tests that open their own contexts (e.g. two devices). */
export async function newAppContext(
  browser: Browser,
  options: BrowserContextOptions = {},
): Promise<BrowserContext> {
  return hydrating(await browser.newContext(options));
}

export const test = base.extend({
  // Named `provide` (not `use`) so the React hooks lint rule does not mistake it for a hook.
  context: async ({ context }, provide) => {
    await provide(hydrating(context));
  },
});

export { expect } from '@playwright/test';
