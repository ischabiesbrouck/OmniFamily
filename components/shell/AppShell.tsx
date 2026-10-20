'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { getRepositories } from '@/lib/db/repositories';
import { useHousehold } from '@/lib/db/repositories/hooks';
import { maybeSweepTombstones } from '@/lib/db/repositories/maintenance';

const NAV = [
  { href: '/', key: 'today' },
  { href: '/calendar', key: 'calendar' },
  { href: '/tasks', key: 'tasks' },
  { href: '/groceries', key: 'groceries' },
  { href: '/settings', key: 'settings' },
] as const;

/** Client shell: sends devices without a household to onboarding, then renders navigation. */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const household = useHousehold();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (household === null) router.replace('/onboarding');
  }, [household, router]);

  useEffect(() => {
    if (!household) return;
    const core = getRepositories().core;
    void maybeSweepTombstones(core, core.time());
  }, [household]);

  if (!household) {
    return (
      <p role="status" className="p-6 text-center">
        {t('common.loading')}
      </p>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-ink/15 px-4 py-2">
        <span className="text-lg font-semibold">{household.householdName}</span>
        <nav aria-label={t('nav.label')} className="overflow-x-auto">
          <ul className="flex gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={
                    (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
                      ? 'page'
                      : undefined
                  }
                  className="inline-flex min-h-12 items-center rounded-lg px-3 font-medium hover:bg-ink/5 aria-[current=page]:bg-ink aria-[current=page]:text-surface"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
