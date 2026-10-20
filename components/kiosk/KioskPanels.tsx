'use client';

import { useTimeZone, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DayAgenda } from '@/components/calendar/DayAgenda';
import { useOccurrences, useTaskProgress } from '@/components/calendar/useOccurrences';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { ParentGate } from '@/components/shell/ParentGate';
import { useReminderScheduler } from '@/components/shell/useReminderScheduler';
import { TaskItem } from '@/components/tasks/TaskItem';
import { Button, BUTTON_BASE, BUTTON_VARIANTS } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useHousehold, useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import { balances } from '@/lib/db/repositories/points';
import { choresForToday } from '@/lib/db/repositories/tasks';
import { occurrencesOnDay } from '@/lib/recurrence/expand';
import { addDays, startOfDayEpoch, todayIn } from '@/lib/time/zoned';

function LeaveKiosk() {
  const router = useRouter();
  useEffect(() => router.push('/'), [router]);
  return null;
}

/** Data-driven part of the wall display; loaded after the shell paints (SPEC §9 budget). */
export default function KioskPanels({ now, resetKey }: { now: number; resetKey: number }) {
  const t = useTranslations('kiosk');
  const tTasks = useTranslations('tasks');
  const zone = useTimeZone() ?? 'UTC';
  const household = useHousehold();
  const members = useMembers() ?? [];
  const tasks = useLiveRecords('task');
  const ledger = useLiveRecords('points');
  const progress = useTaskProgress();
  const [exiting, setExiting] = useState(false);
  // The shell bumps resetKey after a minute idle: close the exit prompt (SPEC §6).
  const [seenReset, setSeenReset] = useState(resetKey);
  if (seenReset !== resetKey) {
    setSeenReset(resetKey);
    setExiting(false);
  }

  useReminderScheduler();

  const today = todayIn(zone, now);
  const tomorrow = addDays(today, 1);
  const window2Days = useMemo(
    () => ({ start: startOfDayEpoch(today, zone), end: startOfDayEpoch(addDays(today, 2), zone) }),
    [today, zone],
  );
  // The wall display is shared: only family-visible events (no active profile).
  const occurrences = useOccurrences(window2Days, zone, null) ?? [];
  const endOfToday = startOfDayEpoch(tomorrow, zone);
  const chores = choresForToday(tasks ?? [], startOfDayEpoch(today, zone), endOfToday);
  const openChores = chores.filter((task) => !task.completed).length;
  const totals = balances(ledger ?? []);

  if (household === null) {
    return (
      <div className="flex flex-col items-start gap-4 text-2xl">
        <p>{t('setup')}</p>
        <Link href="/onboarding" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary}`}>
          {t('setupLink')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="mb-6 flex flex-wrap gap-2" aria-label={tTasks('leaderboard')}>
        {members
          .filter((m) => m.role !== 'guest')
          .map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-4 pl-1 text-lg font-semibold shadow-card"
            >
              <MemberAvatar member={m} size="md" />
              {tTasks('balance', { name: m.name, points: totals.get(m.id) ?? 0 })}
            </li>
          ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-3 lg:gap-6">
        <Card title={t('today')} className="text-lg">
          <DayAgenda
            occurrences={occurrencesOnDay(occurrences, today, zone)}
            members={members}
            progress={progress}
            onOpen={() => {}}
          />
        </Card>
        <Card title={t('tomorrow')} className="text-lg">
          <DayAgenda
            occurrences={occurrencesOnDay(occurrences, tomorrow, zone)}
            members={members}
            progress={progress}
            onOpen={() => {}}
          />
        </Card>
        <Card title={t('chores')} className="text-lg">
          {openChores === 0 && <p className="mb-2 font-semibold text-success">{t('noChores')}</p>}
          {chores.length > 0 && (
            <ul className="flex flex-col gap-2">
              {chores.map((task) => (
                <TaskItem key={task.id} task={task} members={members} hideDelete />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <footer className="mt-10 flex justify-end">
        {exiting ? (
          <div className="w-full max-w-sm">
            <ParentGate>
              <LeaveKiosk />
            </ParentGate>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setExiting(true)}>
            {t('exit')}
          </Button>
        )}
      </footer>
    </>
  );
}
