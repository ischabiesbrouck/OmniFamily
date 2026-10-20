'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getRepositories } from '@/lib/db/repositories';
import { joinWithOfferCode } from '@/lib/sync/pairingFlow';
import { relayUrls } from '@/lib/sync/relay/config';
import { parseInviteCode } from '@/lib/sync/relay/inviteCode';
import { useSyncStore } from '@/stores/syncStore';
import { CodeInput } from './CodeInput';
import { errorKey, type SyncErrorKey } from './errors';
import { QrCode } from './QrCode';
import { SyncStatus } from './SyncStatus';

type InviteErrorKey = 'invalid' | 'not_found' | 'expired' | 'publish_failed';

type Step =
  | { s: 'scan' }
  | { s: 'joining' }
  | { s: 'answer'; frames: string[]; checkCode: string }
  | { s: 'joined'; checkCode: string | null }
  | { s: 'error'; message: `errors.${SyncErrorKey}` | `inviteErrors.${InviteErrorKey}` };

/**
 * Onboarding → "Join an existing family". An invite link or code (D-10.4) joins in one step
 * over the internet; a LAN pairing code (D3) starts the two-code exchange.
 */
export default function JoinFamily({
  onBack,
  initialCode = null,
}: {
  onBack: () => void;
  initialCode?: string | null;
}) {
  const t = useTranslations('sync');
  const router = useRouter();
  const [deviceName, setDeviceName] = useState(() => t('defaultDeviceName'));
  const [step, setStep] = useState<Step>({ s: 'scan' });
  const store = useSyncStore.getState;
  const name = () => deviceName.trim() || t('defaultDeviceName');

  async function joinByInvite(code: string) {
    setStep({ s: 'joining' });
    const [{ RelayPool }, { acceptInvite, InviteError }] = await Promise.all([
      import('@/lib/sync/relay/pool'),
      import('@/lib/sync/relay/invite'),
    ]);
    const pool = new RelayPool(relayUrls());
    try {
      await acceptInvite(getRepositories().core, pool, code, name());
      setStep({ s: 'joined', checkCode: null });
    } catch (error) {
      setStep({
        s: 'error',
        message:
          error instanceof InviteError ? `inviteErrors.${error.code}` : 'inviteErrors.not_found',
      });
    } finally {
      pool.close();
    }
  }

  async function acceptCode(text: string) {
    const invite = parseInviteCode(text);
    if (invite) {
      await joinByInvite(invite);
      return;
    }
    setStep({ s: 'joining' });
    try {
      const join = await joinWithOfferCode(getRepositories().core, text, {
        deviceName: name(),
        onState: (state, error) => store().update(state, error?.code),
      });
      setStep({ s: 'answer', frames: join.frames, checkCode: join.checkCode });
      const connected = await join.connected;
      store().attach(connected.session);
      await connected.ready;
      setStep({ s: 'joined', checkCode: join.checkCode });
    } catch (error) {
      setStep({ s: 'error', message: `errors.${errorKey(error)}` });
    }
  }

  return (
    <section aria-labelledby="join-heading" className="flex flex-col gap-4">
      <h2 id="join-heading" className="text-2xl font-semibold">
        {t('join.title')}
      </h2>
      <p>{initialCode ? t('join.fromLink') : t('join.intro')}</p>

      {step.s === 'scan' && (
        <>
          <TextField
            label={t('join.deviceName')}
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
          {initialCode ? (
            <Button className="self-start" onClick={() => void joinByInvite(initialCode)}>
              {t('join.submit')}
            </Button>
          ) : (
            <>
              <p className="font-medium">{t('join.step1')}</p>
              <CodeInput onCode={(text) => void acceptCode(text)} />
            </>
          )}
        </>
      )}

      {step.s === 'joining' && (
        <p role="status" className="font-medium">
          {t('join.joining')}
        </p>
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
          {step.checkCode ? (
            <>
              <p className="text-lg font-semibold">{t('checkCode', { code: step.checkCode })}</p>
              <p>{t('connected')}</p>
            </>
          ) : (
            <p role="status" className="text-lg font-semibold">
              {t('join.joined')}
            </p>
          )}
          <SyncStatus />
          <Button className="self-start" onClick={() => router.replace('/')}>
            {t('continue')}
          </Button>
        </>
      )}

      {step.s === 'error' && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="font-medium text-danger">
            {t(step.message)}
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
