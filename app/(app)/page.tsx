'use client';

import { CalendarDays, ListChecks, ShoppingBasket, Trophy, Users } from 'lucide-react';
import { useFormatter, useTimeZone, useTranslations, type DateTimeFormatOptions } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import Link from 'next/link';
import { TodayAgenda } from '@/components/calendar/TodayAgenda';
import { useOccurrences } from '@/components/calendar/useOccurrences';
import { WeekStrip } from '@/components/calendar/WeekStrip';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { PointsBoard } from '@/components/tasks/PointsBoard';
import { TaskItem } from '@/components/tasks/TaskItem';
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
  const label = (date: FloatingDate, options: DateTimeFormatOptions) =>
    format.dateTime(floatingDateToUtc(date), { ...options, timeZone: 'UTC' });

  return (
    <div>
      <section className="hero mb-5 rounded-card p-5 shadow-card sm:p-7">
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
        <WeekStrip
          className="-mx-4 mt-4 max-w-xl sm:mx-0"
          dates={week}
          selected={today}
          today={today}
          busy={busy}
          label={label}
          onPick={(d) => router.push(`/calendar?view=day&date=${d}`)}
        />
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
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
