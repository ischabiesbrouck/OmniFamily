'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { Button } from '@/components/ui/Button';
import { useHousehold } from '@/lib/db/repositories/hooks';

// Flag inlined at build time; webpack drops the dead import() when off (D-6.9).
const JoinFamily =
  process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'
    ? dynamic(() => import('@/components/sync/JoinFamily'))
    : null;

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const tSync = useTranslations('sync');
  const household = useHousehold();
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // While joining, the household appears mid-transfer; JoinFamily navigates when done.
    if (household && !joining) router.replace('/');
  }, [household, joining, router]);

  if (joining && JoinFamily) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-6">
        <JoinFamily onBack={() => setJoining(false)} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-6">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p>{t('intro')}</p>
      <OnboardingForm />
      {JoinFamily && (
        <Button variant="secondary" className="self-start" onClick={() => setJoining(true)}>
          {tSync('join.button')}
        </Button>
      )}
    </main>
  );
}
