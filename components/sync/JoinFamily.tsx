'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
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
import { WhoAreYou } from './WhoAreYou';

type InviteErrorKey = 'invalid' | 'not_found' | 'expired' | 'publish_failed';

type Step =
  | { s: 'code' }
  | { s: 'joining' }
  | { s: 'answer'; frames: string[]; checkCode: string }
  | { s: 'who'; checkCode: string | null }
  | { s: 'error'; message: `errors.${SyncErrorKey}` | `inviteErrors.${InviteErrorKey}` };

/**
 * Onboarding → "Join a family". A family code, typed or scanned as a QR code, joins over the
 * internet in one step (D-10.4, D-10.8); a same-Wi-Fi pairing code starts the two-code LAN
 * exchange (D3). Either way the device then asks who it belongs to (D-10.9).
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
  const [code, setCode] = useState(initialCode ?? '');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [step, setStep] = useState<Step>({ s: 'code' });
  const store = useSyncStore.getState;
  const name = () => deviceName.trim() || t('defaultDeviceName');

  async function joinByCode(typed: string) {
    setStep({ s: 'joining' });
    const [{ RelayPool }, { acceptInvite, InviteError }] = await Promise.all([
      import('@/lib/sync/relay/pool'),
      import('@/lib/sync/relay/invite'),
    ]);
    const pool = new RelayPool(relayUrls());
    try {
      await acceptInvite(getRepositories().core, pool, typed, name());
      setStep({ s: 'who', checkCode: null });
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

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!parseInviteCode(code)) {
      setCodeError(t('inviteErrors.invalid'));
      return;
    }
    setCodeError(undefined);
    void joinByCode(code);
  }

  async function scanned(text: string) {
    if (parseInviteCode(text)) await joinByCode(text);
    else await pairOnLan(text);
  }

  async function pairOnLan(text: string) {
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
      setStep({ s: 'who', checkCode: join.checkCode });
    } catch (error) {
      setStep({ s: 'error', message: `errors.${errorKey(error)}` });
    }
  }

  if (step.s === 'who')
    return (
      <section aria-label={t('join.title')} className="flex flex-col gap-4">
        {step.checkCode && (
          <div className="rounded-2xl bg-surface-2 p-4">
            <p className="text-lg font-semibold">{t('checkCode', { code: step.checkCode })}</p>
            <p>{t('connected')}</p>
          </div>
        )}
        <WhoAreYou onDone={() => router.replace('/')} />
      </section>
    );

  return (
    <section aria-labelledby="join-heading" className="flex flex-col gap-4">
      <h2 id="join-heading" className="text-2xl font-semibold">
        {t('join.title')}
      </h2>
      <p>{initialCode ? t('join.fromLink') : t('join.intro')}</p>

      {step.s === 'code' && (
        <>
          <form
            onSubmit={submitCode}
            noValidate
            className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
          >
            <TextField
              label={t('join.codeLabel')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('join.codePlaceholder')}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              error={codeError}
            />
            <TextField
              label={t('join.deviceName')}
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
            <Button type="submit" className="min-h-14 w-full text-lg">
              {t('join.submit')}
            </Button>
            <CodeInput paste={false} onCode={(text) => void scanned(text)} />
          </form>

          <details className="rounded-2xl border border-line p-4">
            <summary className="min-h-6 cursor-pointer font-semibold">{t('lanTitle')}</summary>
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm">{t('join.step1')}</p>
              <CodeInput onCode={(text) => void pairOnLan(text)} />
            </div>
          </details>
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

      {step.s === 'error' && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="font-medium text-danger">
            {t(step.message)}
          </p>
          <Button variant="secondary" className="self-start" onClick={() => setStep({ s: 'code' })}>
            {t('cancel')}
          </Button>
        </div>
      )}

      <Button variant="ghost" className="self-start" onClick={onBack}>
        {t('join.back')}
      </Button>
    </section>
  );
}
