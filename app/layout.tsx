import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { defaultLocale } from '@/lib/i18n/config';
import { catalogues } from '@/lib/i18n/messages';
import './globals.css';

export const metadata: Metadata = {
  title: catalogues[defaultLocale].app.name,
  description: catalogues[defaultLocale].app.tagline,
  applicationName: catalogues[defaultLocale].app.name,
  appleWebApp: { capable: true, title: 'OmniFamily', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#111827',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={defaultLocale}>
      <body className="min-h-dvh antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
