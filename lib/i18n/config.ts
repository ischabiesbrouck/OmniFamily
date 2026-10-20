export const locales = ['en', 'nl'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** First supported locale from a browser preference list such as `navigator.languages`. */
export function resolveLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

/**
 * Full BCP-47 tag used for date/number formatting: the first browser preference in the
 * chosen catalogue's language (so `en-GB` keeps a 24-hour clock), else the catalogue locale.
 */
export function formattingLocale(catalogue: Locale, preferred: readonly string[]): string {
  for (const tag of preferred) {
    if (tag.toLowerCase().split('-')[0] !== catalogue) continue;
    try {
      return Intl.getCanonicalLocales(tag)[0] ?? catalogue;
    } catch {
      continue;
    }
  }
  return catalogue;
}
