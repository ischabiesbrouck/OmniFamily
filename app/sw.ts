/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, Serwist } from 'serwist';
import { handlePeriodicReminders } from '@/lib/notifications/worker';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // Pages are precached by path, so /calendar?view=day&date=… opens offline. React Server
    // Component requests (`_rsc`) keep their key and go to the network; when offline, Next
    // falls back to a document navigation, which the precache answers.
    ignoreURLParametersMatching: [/^(?!_rsc$).+/],
    cleanupOutdatedCaches: true,
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // The self-hosted OCR engine and language data: fetched once, then offline (D-9.4).
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/ocr/'),
      handler: new CacheFirst({
        cacheName: 'ocr-assets',
        plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 })],
      }),
    },
    ...defaultCache,
  ],
});

handlePeriodicReminders(self);
serwist.addEventListeners();
