import { render, screen } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { resolveLocale } from '@/lib/i18n/config';
import { catalogues } from '@/lib/i18n/messages';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function Tagline() {
  return <p>{useTranslations('app')('tagline')}</p>;
}

describe('i18n', () => {
  afterEach(() => vi.restoreAllMocks());

  it('en and nl catalogues have identical keys and no empty strings', () => {
    expect(keys(catalogues.nl).sort()).toEqual(keys(catalogues.en).sort());
    for (const locale of ['en', 'nl'] as const) {
      const flat = JSON.stringify(catalogues[locale]);
      expect(flat).not.toMatch(/:""/);
    }
  });

  it('resolves browser preferences to a supported locale', () => {
    expect(resolveLocale(['nl-BE', 'en'])).toBe('nl');
    expect(resolveLocale(['fr-FR', 'en-GB'])).toBe('en');
    expect(resolveLocale(['de'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });

  it('renders Dutch copy for a Dutch browser and sets <html lang>', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['nl-NL']);
    render(
      <I18nProvider>
        <Tagline />
      </I18nProvider>,
    );
    expect(screen.getByText(catalogues.nl.app.tagline)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('nl');
  });

  it('an explicit locale overrides the browser', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['nl-NL']);
    render(
      <I18nProvider locale="en">
        <Tagline />
      </I18nProvider>,
    );
    expect(screen.getByText(catalogues.en.app.tagline)).toBeInTheDocument();
  });
});
