// SPEC §9: first-load JS (gzip) per route — main routes ≤ 200 KB, kiosk ≤ 150 KB.
// Run after `pnpm build`.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGETS = { '/kiosk/page': 150 * KB };
const DEFAULT_BUDGET = 200 * KB;

const manifest = JSON.parse(readFileSync('.next/app-build-manifest.json', 'utf8'));
const cache = new Map();
const gz = (file) => {
  if (!cache.has(file)) cache.set(file, gzipSync(readFileSync(`.next/${file}`)).length);
  return cache.get(file);
};

let failed = false;
for (const [route, files] of Object.entries(manifest.pages)) {
  if (!route.endsWith('/page')) continue;
  const size = files.filter((f) => f.endsWith('.js')).reduce((sum, f) => sum + gz(f), 0);
  const budget = BUDGETS[route] ?? DEFAULT_BUDGET;
  const ok = size <= budget;
  failed ||= !ok;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${route.padEnd(28)} ${(size / KB).toFixed(1).padStart(6)} KB / ${budget / KB} KB`,
  );
}
if (failed) {
  console.error('JS budget exceeded (SPEC §9).');
  process.exit(1);
}
