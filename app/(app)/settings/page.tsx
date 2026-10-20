'use client';

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MemberSettings } from '@/components/members/MemberSettings';
import { PrivacySection } from '@/components/privacy/PrivacySection';
import { ParentGate } from '@/components/shell/ParentGate';
import { ReminderSettings } from '@/components/shell/ReminderSettings';
import { Select } from '@/components/ui/Select';
import { isLocale, locales } from '@/lib/i18n/config';
import { useDeviceStore } from '@/stores/deviceStore';

// Flag inlined at build time; webpack drops the dead import() when off (D-6.9).
const DevicesSection =
  process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'
    ? dynamic(() => import('@/components/sync/DevicesSection'))
    : null;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tKiosk = useTranslations('kiosk');
  const locale = useDeviceStore((s) => s.locale);
  const setLocale = useDeviceStore((s) => s.setLocale);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
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
      <section aria-labelledby="kiosk-heading" className="flex flex-col gap-2">
        <h2 id="kiosk-heading" className="text-xl font-semibold">
          {tKiosk('title')}
        </h2>
        <p>{tKiosk('openHint')}</p>
        <Link
          href="/kiosk"
          className="inline-flex min-h-12 items-center self-start rounded-lg bg-ink px-4 font-medium text-surface"
        >
          {tKiosk('open')}
        </Link>
      </section>
      {DevicesSection && <DevicesSection />}
      <ReminderSettings />
      <ParentGate>
        <section aria-labelledby="members-heading" className="flex flex-col gap-4">
          <h2 id="members-heading" className="text-xl font-semibold">
            {t('members')}
          </h2>
          <MemberSettings />
        </section>
        <PrivacySection intakeEnabled={process.env.NEXT_PUBLIC_FEATURE_INTAKE === 'true'} />
      </ParentGate>
    </div>
  );
}
