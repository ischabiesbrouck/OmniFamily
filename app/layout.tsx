import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { defaultLocale } from '@/lib/i18n/config';
import { catalogues } from '@/lib/i18n/messages';
import './globals.css';

export const metadata: Metadata = {
  title: catalogues[defaultLocale].app.name,
  description: catalogues[defaultLocale].app.tagline,
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
