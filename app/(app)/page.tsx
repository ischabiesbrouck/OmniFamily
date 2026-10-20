'use client';

import { CalendarDays, ListChecks, ShoppingBasket, Trophy, Users } from 'lucide-react';
import { useFormatter, useTimeZone, useTranslations } from 'next-intl';
import Link from 'next/link';
import { TodayAgenda } from '@/components/calendar/TodayAgenda';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { PointsBoard } from '@/components/tasks/PointsBoard';
import { TaskItem } from '@/components/tasks/TaskItem';
import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import { balances } from '@/lib/db/repositories/points';
import { choresForToday } from '@/lib/db/repositories/tasks';
import { addDays, startOfDayEpoch, todayIn } from '@/lib/time/zoned';
import { useDeviceStore } from '@/stores/deviceStore';

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-accent hover:bg-surface-2"
    >
      {label}
    </Link>
  );
}

export default function TodayPage() {
  const t = useTranslations('today');
  const format = useFormatter();
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

  return (
    <div>
      <PageHeader
        title={active ? t('greeting', { name: active.name }) : t('greetingAnonymous')}
        subtitle={format.dateTime(Date.now(), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: zone,
        })}
      />
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
