'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { Button } from '@/components/ui/Button';
import { useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import { balances } from '@/lib/db/repositories/points';
import type { FamilyTask } from '@/lib/db/schema';
import { TaskForm } from './TaskForm';
import { TaskItem } from './TaskItem';

const byDue = (a: FamilyTask, b: FamilyTask) =>
  (a.dueInstant ?? '￿').localeCompare(b.dueInstant ?? '￿') || a.title.localeCompare(b.title);

export function TasksView() {
  const t = useTranslations('tasks');
  const members = useMembers() ?? [];
  const tasks = useLiveRecords('task');
  const ledger = useLiveRecords('points');
  const events = useLiveRecords('event');
  const [filter, setFilter] = useState<string | null>(null);

  const totals = useMemo(() => balances(ledger ?? []), [ledger]);
  const visible = (tasks ?? []).filter((task) => filter === null || task.assigneeId === filter);
  const open = visible.filter((task) => !task.completed).sort(byDue);
  const done = visible
    .filter((task) => task.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 20);
  const linkable = (events ?? []).filter((e) => !e.recurrenceParentId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <section aria-labelledby="points-heading">
        <h2 id="points-heading" className="mb-2 text-lg font-semibold">
          {t('leaderboard')}
        </h2>
        <ul className="flex flex-wrap gap-3">
          {members
            .filter((m) => m.role !== 'guest')
            .map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-full border border-ink/15 py-1 pr-4 pl-1"
              >
                <MemberAvatar member={m} size="sm" />
                <span>{t('balance', { name: m.name, points: totals.get(m.id) ?? 0 })}</span>
              </li>
            ))}
        </ul>
      </section>

      <TaskForm members={members} events={linkable} />

      <div role="group" aria-label={t('filter')} className="flex flex-wrap gap-1">
        <Button
          variant={filter === null ? 'primary' : 'secondary'}
          aria-pressed={filter === null}
          onClick={() => setFilter(null)}
        >
          {t('everyone')}
        </Button>
        {members.map((m) => (
          <Button
            key={m.id}
            variant={filter === m.id ? 'primary' : 'secondary'}
            aria-pressed={filter === m.id}
            onClick={() => setFilter(m.id)}
          >
            {m.name}
          </Button>
        ))}
      </div>

      <section aria-labelledby="open-heading">
        <h2 id="open-heading" className="mb-2 text-lg font-semibold">
          {t('open')}
        </h2>
        {open.length === 0 ? (
          <p className="text-muted">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map((task) => (
              <TaskItem key={task.id} task={task} members={members} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section aria-labelledby="done-heading">
          <h2 id="done-heading" className="mb-2 text-lg font-semibold">
            {t('done')}
          </h2>
          <ul className="flex flex-col gap-2">
            {done.map((task) => (
              <TaskItem key={task.id} task={task} members={members} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
