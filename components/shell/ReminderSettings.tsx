'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getRepositories } from '@/lib/db/repositories';
import { useSetting } from '@/lib/db/repositories/hooks';
import { setSetting } from '@/lib/db/repositories/settings';
import {
  PERIODIC_SYNC_TAG,
  REMINDER_LEAD_MS,
  REMINDERS_ENABLED_KEY,
} from '@/lib/notifications/reminders';

interface PeriodicSyncManager {
  register(tag: string, options: { minInterval: number }): Promise<void>;
}

async function registerBackgroundCheck(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
    periodicSync?: PeriodicSyncManager;
  };
  if (!registration.periodicSync) return false;
  try {
    await registration.periodicSync.register(PERIODIC_SYNC_TAG, { minInterval: REMINDER_LEAD_MS });
    return true;
  } catch {
    return false; // permission not granted (e.g. not installed) — foreground reminders still work
  }
}

export function ReminderSettings() {
  const t = useTranslations('settings.reminders');
  const enabled = useSetting(REMINDERS_ENABLED_KEY) === true;
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState(() =>
    supported ? Notification.permission : 'denied',
  );
  const [background, setBackground] = useState<boolean | null>(null);
  const db = getRepositories().core.db;

  async function enable() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') return;
    await setSetting(db, REMINDERS_ENABLED_KEY, true);
    setBackground(await registerBackgroundCheck());
  }

  return (
    <section aria-labelledby="reminders-heading" className="flex flex-col gap-3">
      <h2 id="reminders-heading" className="text-xl font-semibold">
        {t('title')}
      </h2>
      <p>{t('description')}</p>
      {!supported ? (
        <p>{t('unsupported')}</p>
      ) : enabled && permission === 'granted' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-medium">{t('enabled')}</p>
          <Button
            variant="secondary"
            onClick={() => void setSetting(db, REMINDERS_ENABLED_KEY, false)}
          >
            {t('disable')}
          </Button>
        </div>
      ) : (
        <Button className="self-start" onClick={() => void enable()}>
          {t('enable')}
        </Button>
      )}
      {permission === 'denied' && supported && <p className="text-danger">{t('denied')}</p>}
      {background === false && <p className="text-muted">{t('foregroundOnly')}</p>}
      <p className="text-sm text-muted">{t('iosNote')}</p>
    </section>
  );
}
