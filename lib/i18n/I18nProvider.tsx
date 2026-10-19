'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { defaultLocale, isLocale, resolveLocale, type Locale } from './config';
import { catalogues } from './messages';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('languagechange', onChange);
  return () => window.removeEventListener('languagechange', onChange);
}

const browserLocale = (): Locale => resolveLocale(navigator.languages);
// Static prerender has no navigator; React re-renders with the client value after hydration.
const serverLocale = (): Locale => defaultLocale;

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function I18nProvider({
  children,
  locale: override,
}: {
  children: ReactNode;
  locale?: Locale | undefined;
}) {
  const detected = useSyncExternalStore(subscribe, browserLocale, serverLocale);
  const locale = isLocale(override) ? override : detected;
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, () => 'UTC');

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={catalogues[locale]} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
