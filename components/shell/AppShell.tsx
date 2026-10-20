'use client';

import {
  CalendarDays,
  Home,
  ListChecks,
  MonitorSmartphone,
  Plus,
  Settings,
  ShoppingBasket,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { EventEditorHost } from '@/components/calendar/LazyEventDialog';
import { Toaster } from '@/components/ui/Toaster';
import { getRepositories } from '@/lib/db/repositories';
import { useHousehold } from '@/lib/db/repositories/hooks';
import { maybeSweepTombstones } from '@/lib/db/repositories/maintenance';
import { useUiStore } from '@/stores/uiStore';
import { BrandMark } from './BrandMark';
import { useReminderScheduler } from './useReminderScheduler';

// Flag inlined at build time; webpack drops the dead import() when off (D-6.9).
const SyncStatus =
  process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'
    ? dynamic(() => import('@/components/sync/SyncStatus').then((m) => m.SyncStatus))
    : null;
const RelaySyncRunner =
  process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'
    ? dynamic(() => import('@/components/sync/RelaySyncRunner'), { ssr: false })
    : null;
// Sheets load on first use; the shell itself stays light (SPEC §9).
const AddSheet = dynamic(() => import('./AddSheet').then((m) => m.AddSheet), { ssr: false });
const ImportSheet = dynamic(
  () => import('@/components/import/ImportSheet').then((m) => m.ImportSheet),
  { ssr: false },
);

const NAV = [
  { href: '/', key: 'today', Icon: Home },
  { href: '/calendar', key: 'calendar', Icon: CalendarDays },
  { href: '/tasks', key: 'tasks', Icon: ListChecks },
  { href: '/groceries', key: 'groceries', Icon: ShoppingBasket },
  { href: '/settings', key: 'settings', Icon: Settings },
] as const;

/**
 * Client shell: sends devices without a household to onboarding, then renders one
 * navigation that is a bottom tab bar on phones and a sidebar from `lg` up.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const household = useHousehold();
  const router = useRouter();
  const pathname = usePathname();
  const sheet = useUiStore((s) => s.sheet);
  const openSheet = useUiStore((s) => s.openSheet);
  useReminderScheduler();

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
      <p role="status" className="p-6 text-center text-muted">
        {t('common.loading')}
      </p>
    );
  }

  const current = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/90 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <BrandMark className="size-8" />
        <span className="min-w-0 truncate font-bold">{household.householdName}</span>
        <span className="ml-auto">{SyncStatus && <SyncStatus />}</span>
      </header>

      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:border-t-0 lg:border-r lg:p-4"
      >
        <div className="hidden items-center gap-3 px-2 pt-2 lg:flex">
          <BrandMark className="size-10" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-bold">{household.householdName}</span>
            <span className="text-sm text-muted">{t('app.name')}</span>
          </span>
        </div>
        <ul className="grid grid-cols-5 lg:flex lg:flex-col lg:gap-1">
          {NAV.map(({ href, key, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={current(href) ? 'page' : undefined}
                className="group flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted aria-[current=page]:text-accent lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-3 lg:text-[0.95rem] lg:hover:bg-surface-2 lg:aria-[current=page]:bg-accent-soft lg:aria-[current=page]:text-accent-soft-ink"
              >
                <Icon aria-hidden="true" className="size-6 lg:size-5" />
                {t(`nav.${key}`)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          {SyncStatus && <SyncStatus />}
          <Link
            href="/kiosk"
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold text-muted hover:bg-surface-2"
          >
            <MonitorSmartphone aria-hidden="true" className="size-5" />
            {t('nav.wallDisplay')}
          </Link>
        </div>
      </nav>

      <div className="min-w-0 pb-28 lg:pb-10">
        <main className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-10 lg:pt-8">
          {children}
        </main>
      </div>

      <button
        type="button"
        aria-label={t('add.title')}
        title={t('add.title')}
        onClick={() => openSheet('add')}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-2xl bg-accent text-on-accent shadow-float transition hover:brightness-110 active:scale-95 lg:right-8 lg:bottom-8"
      >
        <Plus aria-hidden="true" className="size-7" />
      </button>

      {sheet !== null && sheet !== 'import' && <AddSheet />}
      {sheet === 'import' && <ImportSheet />}
      <EventEditorHost />
      {RelaySyncRunner && <RelaySyncRunner />}
      <Toaster />
    </div>
  );
}
