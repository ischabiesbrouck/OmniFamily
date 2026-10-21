'use client';

import { Lock, QrCode, UserRoundPlus, UserRoundX, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { BrandMark } from '@/components/shell/BrandMark';
import { Button } from '@/components/ui/Button';
import { useHousehold } from '@/lib/db/repositories/hooks';
import { formatInviteCode, parseInviteCode } from '@/lib/sync/relay/inviteCode';

// Flag inlined at build time; webpack drops the dead import() when off (D-6.9).
const JoinFamily =
  process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'
    ? dynamic(() => import('@/components/sync/JoinFamily'))
    : null;

const CHOICES = [
  { key: 'create', Icon: UserRoundPlus },
  { key: 'join', Icon: QrCode },
] as const;

const PROPS = [
  { key: 'account', Icon: UserRoundX },
  { key: 'offline', Icon: WifiOff },
  { key: 'private', Icon: Lock },
] as const;

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const tApp = useTranslations('app');
  const household = useHousehold();
  const router = useRouter();
  // Without sync there is nothing to join, so the form shows straight away.
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(JoinFamily ? 'choose' : 'create');
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    // An invite link (D-10.4) carries its secret in the fragment; take it and wipe the URL.
    if (!JoinFamily || !window.location.hash.startsWith('#join=')) return;
    const code = parseInviteCode(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!code) return;
    setInviteCode(formatInviteCode(code));
    setMode('join');
  }, []);

  useEffect(() => {
    // While joining, the household appears mid-way; JoinFamily navigates when done.
    if (household && mode !== 'join') router.replace('/');
  }, [household, mode, router]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hero px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8 text-ink lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-center lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-3">
            <BrandMark className="size-12 rounded-2xl shadow-float" />
            <span className="text-lg font-bold">{tApp('name')}</span>
          </div>
          <p className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{tApp('tagline')}</p>
          <ul className="mt-8 hidden flex-col gap-5 sm:flex">
            {PROPS.map(({ key, Icon }) => (
              <li key={key} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-glass">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{t(`props.${key}Title`)}</span>
                  <span className="block">{t(`props.${key}`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6 sm:px-6 lg:py-12">
        {mode === 'join' && JoinFamily ? (
          <JoinFamily
            initialCode={inviteCode}
            onBack={() => {
              setInviteCode(null);
              setMode('choose');
            }}
          />
        ) : mode === 'create' ? (
          <>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
              <p className="mt-1 text-muted">{t('intro')}</p>
            </div>
            <OnboardingForm />
            {JoinFamily && (
              <Button variant="ghost" className="self-start" onClick={() => setMode('choose')}>
                {t('choose.back')}
              </Button>
            )}
          </>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('choose.title')}</h1>
              <p className="mt-1 text-muted">{t('choose.intro')}</p>
            </div>
            {CHOICES.map(({ key, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className="flex min-h-24 items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4 text-left shadow-card transition hover:border-accent focus-visible:border-accent"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-ink">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span className="flex flex-col">
                  <span className="text-lg font-semibold">{t(`choose.${key}`)}</span>
                  <span className="text-muted">{t(`choose.${key}Hint`)}</span>
                </span>
              </button>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
