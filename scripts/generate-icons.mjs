// Renders public/icons/icon.svg to the PNG sizes the manifest needs.
// Usage: node scripts/generate-icons.mjs   (uses Playwright's Chromium; no extra dependency)
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile('public/icons/icon.svg', 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, inset: 0 },
  { file: 'icon-512.png', size: 512, inset: 0 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0 },
  // Maskable: full-bleed background, artwork inside the 80% safe zone.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.12 },
];

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
for (const { file, size, inset } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const pad = Math.round(size * inset);
  await page.setContent(
    `<body style="margin:0;background:#111827"><div style="padding:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`,
  );
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: inset === 0 });
  await page.close();
}
await browser.close();
console.log('icons written');
