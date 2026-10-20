'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { useHousehold } from '@/lib/db/repositories/hooks';

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const household = useHousehold();
  const router = useRouter();

  useEffect(() => {
    if (household) router.replace('/');
  }, [household, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-6">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p>{t('intro')}</p>
      <OnboardingForm />
    </main>
  );
}
