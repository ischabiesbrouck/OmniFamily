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
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { Toaster } from '@/components/ui/Toaster';
import { getRepositories } from '@/lib/db/repositories';
import { useHousehold, useMembers } from '@/lib/db/repositories/hooks';
import { maybeSweepTombstones } from '@/lib/db/repositories/maintenance';
import { useDeviceStore } from '@/stores/deviceStore';
import { useUiStore } from '@/stores/uiStore';
import { BrandMark } from './BrandMark';
import { MiniMonth } from './MiniMonth';
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
  const members = useMembers();
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
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

  const me = members?.find((m) => m.id === activeMemberId);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[18.5rem_1fr] lg:gap-2">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-canvas/85 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
        {me ? <MemberAvatar member={me} size="sm" /> : <BrandMark className="size-8" />}
        <span className="min-w-0 truncate font-semibold">{household.householdName}</span>
        <span className="ml-auto">{SyncStatus && <SyncStatus />}</span>
      </header>

      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 rounded-card border border-line bg-glass p-1.5 shadow-float backdrop-blur-xl lg:sticky lg:top-3 lg:m-3 lg:mr-0 lg:flex lg:h-[calc(100dvh-1.5rem)] lg:flex-col lg:gap-5 lg:overflow-y-auto lg:bg-surface lg:p-4 lg:shadow-card"
      >
        <div className="hidden items-center gap-3 px-1 pt-1 lg:flex">
          <BrandMark className="size-11" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-lg font-semibold tracking-tight">
              {household.householdName}
            </span>
            <span className="text-sm text-muted">{t('app.name')}</span>
          </span>
        </div>
        <ul className="grid grid-cols-5 lg:flex lg:flex-col lg:gap-1">
          {NAV.map(({ href, key, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={current(href) ? 'page' : undefined}
                className="group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.7rem] font-semibold text-muted aria-[current=page]:text-ink lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-full lg:px-3 lg:text-[0.95rem] lg:hover:bg-surface-2 lg:aria-[current=page]:bg-accent lg:aria-[current=page]:text-on-accent"
              >
                <span className="flex h-8 w-12 items-center justify-center rounded-full transition group-aria-[current=page]:bg-accent group-aria-[current=page]:text-on-accent lg:size-6 lg:w-6 lg:group-aria-[current=page]:bg-transparent">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {t(`nav.${key}`)}
              </Link>
            </li>
          ))}
        </ul>
        {members && members.length > 0 && (
          <section aria-labelledby="sidebar-family" className="hidden flex-col gap-2 lg:flex">
            <h2
              id="sidebar-family"
              className="px-1 text-xs font-semibold tracking-widest text-muted uppercase"
            >
              {t('today.members')}
            </h2>
            <ul className="flex flex-col gap-1">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-1">
                  <MemberAvatar member={m} size="sm" />
                  <span className="truncate font-medium">{m.name}</span>
                  {m.id === activeMemberId && (
                    <span className="ml-auto text-xs text-muted">{t('sync.thisDevice')}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="hidden lg:block">
          <MiniMonth />
        </div>
        <div className="mt-auto hidden flex-col gap-2 lg:flex">
          {SyncStatus && <SyncStatus />}
          <Link
            href="/kiosk"
            className="flex min-h-12 items-center gap-3 rounded-full px-3 font-semibold text-muted hover:bg-surface-2"
          >
            <MonitorSmartphone aria-hidden="true" className="size-5" />
            {t('nav.wallDisplay')}
          </Link>
        </div>
      </nav>

      <div className="min-w-0 pb-32 lg:pb-10">
        <main className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>

      <button
        type="button"
        aria-label={t('add.title')}
        title={t('add.title')}
        onClick={() => openSheet('add')}
        className="fixed right-5 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-float transition hover:opacity-90 active:scale-95 lg:right-8 lg:bottom-8 lg:size-16"
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
