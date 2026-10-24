'use client';

import { MonitorSmartphone, Palette, Settings as SettingsIcon, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MemberSettings } from '@/components/members/MemberSettings';
import { PrivacySection } from '@/components/privacy/PrivacySection';
import { ParentGate } from '@/components/shell/ParentGate';
import { ReminderSettings } from '@/components/shell/ReminderSettings';
import { BUTTON_BASE, BUTTON_VARIANTS } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { isLocale, locales } from '@/lib/i18n/config';
import { useDeviceStore, type ThemePreference } from '@/stores/deviceStore';

// Flag inlined at build time; webpack drops the dead import() when off (D-6.9).
const DevicesSection =
  process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'
    ? dynamic(() => import('@/components/sync/DevicesSection'))
    : null;

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tKiosk = useTranslations('kiosk');
  const locale = useDeviceStore((s) => s.locale);
  const setLocale = useDeviceStore((s) => s.setLocale);
  const theme = useDeviceStore((s) => s.theme);
  const setTheme = useDeviceStore((s) => s.setTheme);

  return (
    <div>
      <PageHeader
        title={t('title')}
        visual={
          <span className="flex size-20 items-center justify-center rounded-full bg-glass shadow-card">
            <SettingsIcon aria-hidden="true" className="size-9" />
          </span>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card title={t('appearance')} icon={<Palette aria-hidden="true" className="size-5" />}>
            <div className="flex flex-col gap-4">
              <Select
                className="max-w-xs"
                label={t('language')}
                value={locale ?? ''}
                options={[
                  { value: '', label: t('languageAuto') },
                  ...locales.map((l) => ({ value: l, label: t(`languages.${l}`) })),
                ]}
                onChange={(e) => setLocale(isLocale(e.target.value) ? e.target.value : null)}
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{t('theme')}</span>
                <Segmented
                  label={t('theme')}
                  value={theme}
                  options={THEMES.map((v) => ({ value: v, label: t(`themes.${v}`) }))}
                  onChange={setTheme}
                />
              </div>
            </div>
          </Card>
          {DevicesSection && <DevicesSection />}
          <Card
            title={tKiosk('title')}
            icon={<MonitorSmartphone aria-hidden="true" className="size-5" />}
          >
            <p className="mb-3 text-muted">{tKiosk('openHint')}</p>
            <Link href="/kiosk" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary}`}>
              {tKiosk('open')}
            </Link>
          </Card>
          <ReminderSettings />
        </div>
        <div className="flex flex-col gap-4">
          <ParentGate>
            <Card title={t('members')} icon={<Users aria-hidden="true" className="size-5" />}>
              <MemberSettings />
            </Card>
            <PrivacySection intakeEnabled={process.env.NEXT_PUBLIC_FEATURE_INTAKE === 'true'} />
          </ParentGate>
        </div>
      </div>
    </div>
  );
}
