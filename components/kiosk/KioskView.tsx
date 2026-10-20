'use client';

import { useFormatter, useTimeZone, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useBurnInOffset, useIdle, useMinuteClock, useWakeLock } from './hooks';

export const KIOSK_IDLE_MS = 60_000;

function Loading() {
  const t = useTranslations('common');
  return <p role="status">{t('loading')}</p>;
}

// IndexedDB, recurrence and task code arrive after the clock has painted (SPEC §9).
const KioskPanels = dynamic(() => import('./KioskPanels'), { ssr: false, loading: Loading });

export function KioskView() {
  const t = useTranslations('kiosk');
  const format = useFormatter();
  const zone = useTimeZone() ?? 'UTC';
  const now = useMinuteClock();
  const [dx, dy] = useBurnInOffset();
  const [resetKey, setResetKey] = useState(0);

  useWakeLock();
  // Back to the overview after a minute without input (SPEC §6).
  useIdle(KIOSK_IDLE_MS, () => {
    setResetKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  });

  return (
    <main
      className="min-h-dvh p-6 transition-transform duration-200 lg:p-10"
      style={{ transform: `translate(${dx}px, ${dy}px)` }}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <h1 className="sr-only">{t('title')}</h1>
        <p className="text-7xl font-bold tracking-tight tabular-nums lg:text-8xl">
          {format.dateTime(now, { hour: '2-digit', minute: '2-digit', timeZone: zone })}
        </p>
        <p className="text-2xl font-semibold text-muted first-letter:uppercase">
          {format.dateTime(now, { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone })}
        </p>
      </header>
      <KioskPanels now={now} resetKey={resetKey} />
    </main>
  );
}
