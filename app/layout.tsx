import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { defaultLocale } from '@/lib/i18n/config';
import { catalogues } from '@/lib/i18n/messages';
import { withBase } from '@/lib/pwa/basePath';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import { ThemeController } from './ThemeController';
import '@fontsource-variable/dm-sans/wght.css';
import './globals.css';

export const metadata: Metadata = {
  title: catalogues[defaultLocale].app.name,
  description: catalogues[defaultLocale].app.tagline,
  applicationName: catalogues[defaultLocale].app.name,
  appleWebApp: { capable: true, title: 'OmniFamily', statusBarStyle: 'default' },
  icons: { icon: withBase('/icons/icon-192.png'), apple: withBase('/icons/apple-touch-icon.png') },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef0f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0c10' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        {/* Applies a saved theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeController />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
