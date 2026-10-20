'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getRepositories } from '@/lib/db/repositories';
import { useHousehold, useLiveRecords } from '@/lib/db/repositories/hooks';
import { startHostPairing, type HostPairing } from '@/lib/sync/pairingFlow';
import { useSyncStore } from '@/stores/syncStore';
import { CodeInput } from './CodeInput';
import { errorKey, type SyncErrorKey } from './errors';
import { QrCode } from './QrCode';
import { SyncStatus } from './SyncStatus';

type Step =
  | { s: 'idle' }
  | { s: 'offer'; pairing: HostPairing }
  | { s: 'connecting'; checkCode: string }
  | { s: 'connected'; checkCode: string }
  | { s: 'error'; key: SyncErrorKey };

/** Settings → Devices: device registry and "connect another device" (host side of D3). */
export default function DevicesSection() {
  const t = useTranslations('sync');
  const household = useHousehold();
  const devices = useLiveRecords('device') ?? [];
  const session = useSyncStore((s) => s.session);
  const [step, setStep] = useState<Step>({ s: 'idle' });
  const myName = devices.find((d) => d.id === household?.deviceId)?.name ?? t('defaultDeviceName');
  const core = getRepositories().core;
  const store = useSyncStore.getState;

  async function begin() {
    try {
      const pairing = await startHostPairing(core, {
        deviceName: myName,
        onState: (state, error) => store().update(state, error?.code),
      });
      setStep({ s: 'offer', pairing });
    } catch (error) {
      setStep({ s: 'error', key: errorKey(error) });
    }
  }

  async function answer(text: string) {
    if (step.s !== 'offer') return;
    try {
      const connected = await step.pairing.complete(text);
      store().attach(connected.session);
      setStep({ s: 'connecting', checkCode: connected.checkCode });
      await connected.ready;
      // Keep the check code up so people can compare both screens at their own pace.
      setStep({ s: 'connected', checkCode: connected.checkCode });
    } catch (error) {
      setStep({ s: 'error', key: errorKey(error) });
    }
  }

  return (
    <section aria-labelledby="devices-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="devices-heading" className="text-xl font-semibold">
          {t('devices')}
        </h2>
        <SyncStatus />
      </div>
      <p>{t('lanNote')}</p>
      <ul className="flex flex-col gap-1">
        {devices
          .filter((d) => !d.revoked)
          .map((d) => (
            <li key={d.id} className="font-medium">
              {d.name}
              {d.id === household?.deviceId && (
                <span className="text-muted"> · {t('thisDevice')}</span>
              )}
            </li>
          ))}
      </ul>

      {step.s === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void begin()}>{t('connect')}</Button>
          {session && (
            <Button variant="secondary" onClick={() => store().disconnect()}>
              {t('disconnect')}
            </Button>
          )}
        </div>
      )}

      {step.s === 'offer' && (
        <div className="flex flex-col gap-4 rounded-lg border border-ink/20 p-4">
          <p className="font-medium">{t('hostStep1')}</p>
          <QrCode frames={step.pairing.frames} />
          <p className="font-medium">{t('hostStep2')}</p>
          <CodeInput onCode={(text) => void answer(text)} />
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => {
              step.pairing.cancel();
              setStep({ s: 'idle' });
            }}
          >
            {t('cancel')}
          </Button>
        </div>
      )}

      {(step.s === 'connecting' || step.s === 'connected') && (
        <div className="flex flex-col gap-2 rounded-lg border border-ink/20 p-4">
          <p className="text-lg font-semibold">{t('checkCode', { code: step.checkCode })}</p>
          {step.s === 'connected' && (
            <>
              <p>{t('connected')}</p>
              <Button className="self-start" onClick={() => setStep({ s: 'idle' })}>
                {t('done')}
              </Button>
            </>
          )}
        </div>
      )}

      {step.s === 'error' && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="font-medium text-danger">
            {t(`errors.${step.key}`)}
          </p>
          <Button variant="secondary" className="self-start" onClick={() => setStep({ s: 'idle' })}>
            {t('cancel')}
          </Button>
        </div>
      )}
    </section>
  );
}
