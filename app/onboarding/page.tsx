'use client';

import { Lock, UserRoundX, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { BrandMark } from '@/components/shell/BrandMark';
import { Button } from '@/components/ui/Button';
import { useHousehold } from '@/lib/db/repositories/hooks';
import { parseInviteCode } from '@/lib/sync/relay/inviteCode';

// Flag inlined at build time; webpack drops the dead import() when off (D-6.9).
const JoinFamily =
  process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'
    ? dynamic(() => import('@/components/sync/JoinFamily'))
    : null;

const PROPS = [
  { key: 'account', Icon: UserRoundX },
  { key: 'offline', Icon: WifiOff },
  { key: 'private', Icon: Lock },
] as const;

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const tApp = useTranslations('app');
  const tSync = useTranslations('sync');
  const household = useHousehold();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    // An invite link (D-10.4) carries its secret in the fragment; take it and wipe the URL.
    if (!JoinFamily || !window.location.hash.startsWith('#join=')) return;
    const code = parseInviteCode(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!code) return;
    setInviteCode(code);
    setJoining(true);
  }, []);

  useEffect(() => {
    // While joining, the household appears mid-transfer; JoinFamily navigates when done.
    if (household && !joining) router.replace('/');
  }, [household, joining, router]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-accent px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8 text-on-accent lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-center lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-3">
            <BrandMark className="size-12 rounded-2xl ring-2 ring-on-accent/40" />
            <span className="text-lg font-bold">{tApp('name')}</span>
          </div>
          <p className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{tApp('tagline')}</p>
          <ul className="mt-8 hidden flex-col gap-5 sm:flex">
            {PROPS.map(({ key, Icon }) => (
              <li key={key} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-on-accent/15">
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
        {joining && JoinFamily ? (
          <JoinFamily
            initialCode={inviteCode}
            onBack={() => {
              setInviteCode(null);
              setJoining(false);
            }}
          />
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
              <p className="mt-1 text-muted">{t('intro')}</p>
            </div>
            <OnboardingForm />
            {JoinFamily && (
              <Button variant="secondary" className="w-full" onClick={() => setJoining(true)}>
                {tSync('join.button')}
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
