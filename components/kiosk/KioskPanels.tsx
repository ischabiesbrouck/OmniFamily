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
import { Button } from '@/components/ui/Button';
import { useHousehold, useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import { balances } from '@/lib/db/repositories/points';
import { occurrencesOnDay } from '@/lib/recurrence/expand';
import { addDays, instantToEpoch, startOfDayEpoch, todayIn } from '@/lib/time/zoned';

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
  const chores = (tasks ?? [])
    .filter(
      (task) =>
        !task.completed && (!task.dueInstant || instantToEpoch(task.dueInstant) < endOfToday),
    )
    .sort((a, b) => (a.dueInstant ?? '￿').localeCompare(b.dueInstant ?? '￿'));
  const totals = balances(ledger ?? []);

  if (household === null) {
    return (
      <div className="flex flex-col items-start gap-4 text-2xl">
        <p>{t('setup')}</p>
        <Link
          href="/onboarding"
          className="inline-flex min-h-12 items-center rounded-lg bg-ink px-6 text-surface"
        >
          {t('setupLink')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="mb-8 flex flex-wrap gap-3" aria-label={tTasks('leaderboard')}>
        {members
          .filter((m) => m.role !== 'guest')
          .map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-lg">
              <MemberAvatar member={m} size="md" />
              {tTasks('balance', { name: m.name, points: totals.get(m.id) ?? 0 })}
            </li>
          ))}
      </ul>

      <div className="grid gap-8 text-lg md:grid-cols-3">
        <section aria-labelledby="k-today">
          <h2 id="k-today" className="mb-3 text-3xl font-semibold">
            {t('today')}
          </h2>
          <DayAgenda
            occurrences={occurrencesOnDay(occurrences, today, zone)}
            members={members}
            progress={progress}
            onOpen={() => {}}
          />
        </section>
        <section aria-labelledby="k-tomorrow">
          <h2 id="k-tomorrow" className="mb-3 text-3xl font-semibold">
            {t('tomorrow')}
          </h2>
          <DayAgenda
            occurrences={occurrencesOnDay(occurrences, tomorrow, zone)}
            members={members}
            progress={progress}
            onOpen={() => {}}
          />
        </section>
        <section aria-labelledby="k-chores">
          <h2 id="k-chores" className="mb-3 text-3xl font-semibold">
            {t('chores')}
          </h2>
          {chores.length === 0 ? (
            <p>{t('noChores')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {chores.map((task) => (
                <TaskItem key={task.id} task={task} members={members} hideDelete />
              ))}
            </ul>
          )}
        </section>
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
