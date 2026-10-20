import type { MetadataRoute } from 'next';
import { defaultLocale } from '@/lib/i18n/config';
import { catalogues } from '@/lib/i18n/messages';
import { withBase } from '@/lib/pwa/basePath';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const { app } = catalogues[defaultLocale];
  return {
    id: withBase('/'),
    name: app.name,
    short_name: 'OmniFamily',
    description: app.tagline,
    start_url: withBase('/'),
    scope: withBase('/'),
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#111827',
    categories: ['lifestyle', 'productivity'],
    icons: [
      { src: withBase('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: withBase('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: withBase('/icons/icon-maskable-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [{ name: catalogues[defaultLocale].kiosk.title, url: withBase('/kiosk') }],
  };
}
