'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { defaultLocale, formattingLocale, isLocale, resolveLocale, type Locale } from './config';
import { catalogues } from './messages';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('languagechange', onChange);
  return () => window.removeEventListener('languagechange', onChange);
}

// A joined string keeps the snapshot referentially stable between renders.
const browserLanguages = (): string => navigator.languages.join(',');
// Static prerender has no navigator; React re-renders with the client value after hydration.
const serverLanguages = (): string => defaultLocale;

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
  const languages = useSyncExternalStore(subscribe, browserLanguages, serverLanguages).split(',');
  const chosen = useDeviceStore((s) => s.locale);
  const locale = isLocale(override)
    ? override
    : isLocale(chosen)
      ? chosen
      : resolveLocale(languages);
  const formatLocale = formattingLocale(locale, languages);
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, () => 'UTC');

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <NextIntlClientProvider locale={formatLocale} messages={catalogues[locale]} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
