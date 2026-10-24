'use client';

import {
  CalendarDays,
  ChevronRight,
  HelpCircle,
  ListChecks,
  ShoppingBasket,
  Trophy,
  Users,
} from 'lucide-react';
import { useFormatter, useTimeZone, useTranslations, type DateTimeFormatOptions } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import Link from 'next/link';
import { occurrenceColor, useTimeLabel } from '@/components/calendar/OccurrenceChip';
import { TodayAgenda } from '@/components/calendar/TodayAgenda';
import { useMinuteClock } from '@/components/kiosk/hooks';
import { useOccurrences } from '@/components/calendar/useOccurrences';
import { WeekStrip } from '@/components/calendar/WeekStrip';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { PointsBoard } from '@/components/tasks/PointsBoard';
import { TaskItem } from '@/components/tasks/TaskItem';
import { BUTTON_BASE, BUTTON_VARIANTS, Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { weekDates, windowFor } from '@/lib/calendar/grid';
import { useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import { balances } from '@/lib/db/repositories/points';
import { choresForToday } from '@/lib/db/repositories/tasks';
import { occurrencesOnDay } from '@/lib/recurrence/expand';
import {
  addDays,
  floatingDateToUtc,
  startOfDayEpoch,
  todayIn,
  type FloatingDate,
} from '@/lib/time/zoned';
import { useDeviceStore } from '@/stores/deviceStore';
import { useUiStore } from '@/stores/uiStore';

const STATS = [
  { key: 'events', href: '/calendar?view=day', Icon: CalendarDays },
  { key: 'chores', href: '/tasks', Icon: ListChecks },
  { key: 'shopping', href: '/groceries', Icon: ShoppingBasket },
] as const;

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center rounded-full px-4 text-sm font-semibold text-ink hover:bg-surface-2"
    >
      {label}
    </Link>
  );
}

export default function TodayPage() {
  const t = useTranslations('today');
  const format = useFormatter();
  const router = useRouter();
  const tHelp = useTranslations('help');
  const guideSeen = useDeviceStore((st) => st.guideSeen);
  const setGuideSeen = useDeviceStore((st) => st.setGuideSeen);
  const tCal = useTranslations('calendar');
  const time = useTimeLabel();
  const openEditor = useUiStore((s) => s.openEditor);
  const zone = useTimeZone() ?? 'UTC';
  const members = useMembers() ?? [];
  const tasks = useLiveRecords('task') ?? [];
  const groceries = useLiveRecords('grocery') ?? [];
  const ledger = useLiveRecords('points') ?? [];
  const activeId = useDeviceStore((s) => s.activeMemberId);
  const active = members.find((m) => m.id === activeId);

  const today = todayIn(zone);
  const chores = choresForToday(
    tasks,
    startOfDayEpoch(today, zone),
    startOfDayEpoch(addDays(today, 1), zone),
  );
  const openChores = chores.filter((task) => !task.completed).length;
  const toBuy = groceries.filter((g) => !g.purchased);
  const week = weekDates(today);
  const window = useMemo(() => windowFor('week', today, zone), [today, zone]);
  const occurrences = useOccurrences(window, zone, activeId) ?? [];
  const busy = new Set(week.filter((d) => occurrencesOnDay(occurrences, d, zone).length > 0));
  const todayCount = occurrencesOnDay(occurrences, today, zone).length;
  const stats = { events: todayCount, chores: openChores, shopping: toBuy.length };
  const now = useMinuteClock();
  const next = occurrences
    .filter((o) => !o.isAllDay && o.end > now)
    .sort((a, b) => a.start - b.start)[0];
  const label = (date: FloatingDate, options: DateTimeFormatOptions) =>
    format.dateTime(floatingDateToUtc(date), { ...options, timeZone: 'UTC' });

  return (
    <div>
      <section className="hero mb-5 rounded-card p-5 shadow-card sm:p-7 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide first-letter:uppercase">
            {format.dateTime(Date.now(), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: zone,
            })}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-5xl">
            {active ? t('greeting', { name: active.name }) : t('greetingAnonymous')}
          </h1>
          <p className="mt-2 text-base sm:text-lg">
            {t('summary', { events: todayCount, chores: openChores })}
          </p>
          {next && (
            <button
              type="button"
              onClick={() => openEditor({ mode: 'edit', occurrence: next })}
              className="tint tint-bar mt-4 flex w-full max-w-xl items-center gap-3 rounded-tile py-3 pr-3 pl-5 text-left text-ink shadow-card transition hover:brightness-95"
              style={{ ['--tint' as string]: occurrenceColor(next, members) }}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-semibold tracking-widest uppercase">
                  {t('upNext')} ·{' '}
                  {next.start <= now ? t('now') : format.relativeTime(next.start, now)}
                </span>
                <span className="truncate text-lg font-semibold">{next.event.title}</span>
                <span className="truncate text-sm">
                  {tCal('timeRange', { start: time(next.start), end: time(next.end) })}
                  {next.event.location ? ` · ${next.event.location}` : ''}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
            </button>
          )}
          <WeekStrip
            className="-mx-4 mt-4 max-w-xl sm:mx-0"
            dates={week}
            selected={today}
            today={today}
            busy={busy}
            label={label}
            onPick={(d) => router.push(`/calendar?view=day&date=${d}`)}
          />
        </div>
        <ul className="hidden flex-col justify-center gap-3 lg:flex">
          {STATS.map(({ key, href, Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex items-center gap-4 rounded-tile bg-glass p-4 shadow-card transition hover:-translate-y-0.5"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-3xl leading-none font-semibold tabular-nums">
                    {stats[key]}
                  </span>
                  <span className="mt-1 text-sm font-medium">{t(`stats.${key}`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {!guideSeen && (
        <section
          aria-labelledby="welcome-guide"
          className="mb-5 flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink">
            <HelpCircle aria-hidden="true" className="size-6" />
          </span>
          <div className="min-w-0 flex-1 basis-56">
            <h2 id="welcome-guide" className="text-lg font-semibold">
              {tHelp('welcome.title')}
            </h2>
            <p className="text-muted">{tHelp('welcome.text')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/help"
              onClick={setGuideSeen}
              className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary}`}
            >
              {tHelp('welcome.open')}
            </Link>
            <Button variant="ghost" onClick={setGuideSeen}>
              {tHelp('welcome.dismiss')}
            </Button>
          </div>
        </section>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card
          title={t('agenda')}
          icon={<CalendarDays aria-hidden="true" className="size-5" />}
          action={<SeeAll href="/calendar" label={t('openCalendar')} />}
          className="lg:col-span-2"
        >
          <TodayAgenda />
        </Card>
        <Card title={t('points')} icon={<Trophy aria-hidden="true" className="size-5" />}>
          <PointsBoard members={members} totals={balances(ledger)} />
        </Card>
        <Card
          title={t('chores')}
          icon={<ListChecks aria-hidden="true" className="size-5" />}
          action={<SeeAll href="/tasks" label={t('seeAll')} />}
          className="lg:col-span-2"
        >
          {openChores === 0 && (
            <EmptyState
              icon={<ListChecks aria-hidden="true" className="size-6" />}
              title={t('noChores')}
            />
          )}
          {chores.length > 0 && (
            <ul className={`flex flex-col gap-2 ${openChores === 0 ? 'mt-3' : ''}`}>
              {chores.slice(0, 8).map((task) => (
                <TaskItem key={task.id} task={task} members={members} hideDelete />
              ))}
            </ul>
          )}
        </Card>
        <Card
          title={t('shopping')}
          icon={<ShoppingBasket aria-hidden="true" className="size-5" />}
          action={<SeeAll href="/groceries" label={t('seeAll')} />}
        >
          <p className="font-semibold">{t('shoppingCount', { count: toBuy.length })}</p>
          {toBuy.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {toBuy.slice(0, 8).map((g) => (
                <li key={g.id} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
                  {g.name}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title={t('members')}
          icon={<Users aria-hidden="true" className="size-5" />}
          className="lg:col-span-3"
        >
          <ul className="flex flex-wrap gap-x-5 gap-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <MemberAvatar member={m} size="sm" />
                <span className="font-medium">{m.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
