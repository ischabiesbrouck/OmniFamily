'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getRepositories } from '@/lib/db/repositories';
import { joinWithOfferCode } from '@/lib/sync/pairingFlow';
import { useSyncStore } from '@/stores/syncStore';
import { CodeInput } from './CodeInput';
import { errorKey, type SyncErrorKey } from './errors';
import { QrCode } from './QrCode';
import { SyncStatus } from './SyncStatus';

type Step =
  | { s: 'scan' }
  | { s: 'answer'; frames: string[]; checkCode: string }
  | { s: 'joined'; checkCode: string }
  | { s: 'error'; key: SyncErrorKey };

/** Onboarding → "Join an existing family" (joining side of D3). */
export default function JoinFamily({ onBack }: { onBack: () => void }) {
  const t = useTranslations('sync');
  const router = useRouter();
  const [deviceName, setDeviceName] = useState(() => t('defaultDeviceName'));
  const [step, setStep] = useState<Step>({ s: 'scan' });
  const [busy, setBusy] = useState(false);
  const store = useSyncStore.getState;

  async function acceptOffer(text: string) {
    setBusy(true);
    try {
      const join = await joinWithOfferCode(getRepositories().core, text, {
        deviceName: deviceName.trim() || t('defaultDeviceName'),
        onState: (state, error) => store().update(state, error?.code),
      });
      setStep({ s: 'answer', frames: join.frames, checkCode: join.checkCode });
      const connected = await join.connected;
      store().attach(connected.session);
      await connected.ready;
      setStep({ s: 'joined', checkCode: join.checkCode });
    } catch (error) {
      setStep({ s: 'error', key: errorKey(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="join-heading" className="flex flex-col gap-4">
      <h2 id="join-heading" className="text-2xl font-semibold">
        {t('join.title')}
      </h2>
      <p>{t('join.intro')}</p>
      <p className="text-sm text-muted">{t('lanNote')}</p>

      {step.s === 'scan' && (
        <>
          <TextField
            label={t('join.deviceName')}
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
          <p className="font-medium">{t('join.step1')}</p>
          <CodeInput onCode={(text) => void acceptOffer(text)} disabled={busy} />
        </>
      )}

      {step.s === 'answer' && (
        <>
          <p className="font-medium">{t('join.step2')}</p>
          <QrCode frames={step.frames} />
          <p className="text-lg font-semibold">{t('checkCode', { code: step.checkCode })}</p>
          <p role="status">{t('join.waiting')}</p>
          <SyncStatus />
        </>
      )}

      {step.s === 'joined' && (
        <>
          <p className="text-lg font-semibold">{t('checkCode', { code: step.checkCode })}</p>
          <p>{t('connected')}</p>
          <SyncStatus />
          <Button className="self-start" onClick={() => router.replace('/')}>
            {t('continue')}
          </Button>
        </>
      )}

      {step.s === 'error' && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="font-medium text-danger">
            {t(`errors.${step.key}`)}
          </p>
          <Button variant="secondary" className="self-start" onClick={() => setStep({ s: 'scan' })}>
            {t('cancel')}
          </Button>
        </div>
      )}

      {step.s !== 'joined' && (
        <Button variant="ghost" className="self-start" onClick={onBack}>
          {t('join.back')}
        </Button>
      )}
    </section>
  );
}
