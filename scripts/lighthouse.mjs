// SPEC §8 Phase 5 / §9: Lighthouse accessibility = 100, FCP < 1.5 s, TTI < 3.0 s with
// Lighthouse's default mobile emulation and throttling. Run after `pnpm build`.
// Lighthouse 12+ has no PWA category; installability is asserted in tests/e2e/offline.spec.ts.
import { spawn } from 'node:child_process';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const PORT = 3100;
const ROUTES = ['/onboarding', '/kiosk'];
const LIMITS = { fcp: 1500, tti: 3000 };

const server = spawn('pnpm', ['exec', 'next', 'start', '--port', String(PORT)], {
  stdio: 'ignore',
});
const base = `http://localhost:${PORT}`;
for (let i = 0; i < 60; i += 1) {
  try {
    if ((await fetch(base + '/manifest.webmanifest')).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH ?? process.env.PW_CHROMIUM_PATH,
  chromeFlags: ['--headless=new', '--no-sandbox'],
});
let failed = false;
try {
  for (const route of ROUTES) {
    const { lhr } = await lighthouse(base + route, {
      port: chrome.port,
      onlyCategories: ['accessibility', 'performance', 'best-practices'],
      output: 'json',
      logLevel: 'error',
    });
    const a11y = Math.round((lhr.categories.accessibility.score ?? 0) * 100);
    const fcp = lhr.audits['first-contentful-paint'].numericValue ?? Infinity;
    const tti = lhr.audits.interactive.numericValue ?? Infinity;
    const ok = a11y === 100 && fcp < LIMITS.fcp && tti < LIMITS.tti;
    failed ||= !ok;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${route.padEnd(12)} a11y ${a11y}  perf ${Math.round((lhr.categories.performance.score ?? 0) * 100)}  best-practices ${Math.round((lhr.categories['best-practices'].score ?? 0) * 100)}  FCP ${Math.round(fcp)} ms  TTI ${Math.round(tti)} ms`,
    );
    for (const [id, audit] of Object.entries(lhr.audits)) {
      if (
        audit.score !== null &&
        audit.score < 1 &&
        lhr.categories.accessibility.auditRefs.some((r) => r.id === id)
      ) {
        console.log(`     a11y: ${id} — ${audit.title}`);
      }
    }
  }
} finally {
  await chrome.kill();
  server.kill();
}
if (failed) process.exit(1);
