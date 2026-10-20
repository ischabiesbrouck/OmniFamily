import { randomUUID } from 'node:crypto';
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';
import { APP_ROUTES } from './lib/pwa/routes';

// GitHub Pages build (D-8.1): static export under /OmniFamily. Unset everywhere else.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const staticExport = process.env.NEXT_OUTPUT === 'export';

// One revision per build: every page is re-precached when a new service worker installs.
const revision = process.env.BUILD_REVISION ?? randomUUID();

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [
    ...APP_ROUTES.map((route) => (staticExport && route !== '/' ? `${route}/` : route)),
    '/manifest.webmanifest',
  ].map((url) => ({ url: `${basePath}${url}`, revision })),
  // Only the icons are precached from public/; the 17 MB OCR engine in public/ocr is
  // fetched on first photo import and then cached at runtime (app/sw.ts, D-9.4).
  globPublicPatterns: ['icons/**/*'],
  // A reload would discard half-typed forms and interrupt the kiosk.
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development',
});

// D1: the product surface is client components only. Do not enable Server Actions.
const nextConfig: NextConfig = {
  // Always defined, so the inlined flags are constants and dead code is dropped (D-6.9, D-7.3).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_FEATURE_SYNC: process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true' ? 'true' : 'false',
    NEXT_PUBLIC_FEATURE_INTAKE:
      process.env.NEXT_PUBLIC_FEATURE_INTAKE === 'true' ? 'true' : 'false',
  },
  ...(basePath ? { basePath } : {}),
  // Trailing slashes keep every URL (even the bare /OmniFamily/) inside the service
  // worker's scope; GitHub Pages cannot send Service-Worker-Allowed to widen it (D-8.3).
  ...(staticExport ? { output: 'export' as const, trailingSlash: true } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
};

export default withSerwist(nextConfig);
