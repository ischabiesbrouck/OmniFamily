'use client';

import { CheckCheck, ListChecks, Plus, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { Card, EmptyState, PageHeader } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useLiveRecords, useMembers } from '@/lib/db/repositories/hooks';
import { balances } from '@/lib/db/repositories/points';
import type { FamilyTask } from '@/lib/db/schema';
import { PointsBoard } from './PointsBoard';
import { TaskForm } from './TaskForm';
import { TaskItem } from './TaskItem';

const byDue = (a: FamilyTask, b: FamilyTask) =>
  (a.dueInstant ?? '￿').localeCompare(b.dueInstant ?? '￿') || a.title.localeCompare(b.title);

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line-strong bg-surface px-3 font-semibold transition aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
    >
      {children}
    </button>
  );
}

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
  const doneCount = visible.filter((task) => task.completed).length;
  const linkable = (events ?? []).filter((e) => !e.recurrenceParentId);

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('summary', { open: open.length, done: doneCount })}
        visual={
          <ProgressRing
            done={doneCount}
            total={doneCount + open.length}
            label={t('progress', { done: doneCount, total: doneCount + open.length })}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title={t('newTask')} icon={<Plus aria-hidden="true" className="size-5" />}>
            <TaskForm members={members} events={linkable} />
          </Card>

          <div role="group" aria-label={t('filter')} className="flex flex-wrap gap-2">
            <FilterChip pressed={filter === null} onClick={() => setFilter(null)}>
              {t('everyone')}
            </FilterChip>
            {members.map((m) => (
              <FilterChip key={m.id} pressed={filter === m.id} onClick={() => setFilter(m.id)}>
                <MemberAvatar member={m} size="sm" />
                {m.name}
              </FilterChip>
            ))}
          </div>

          <Card title={t('open')} icon={<ListChecks aria-hidden="true" className="size-5" />}>
            {open.length === 0 ? (
              <EmptyState
                icon={<CheckCheck aria-hidden="true" className="size-6" />}
                title={t('empty')}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {open.map((task) => (
                  <TaskItem key={task.id} task={task} members={members} />
                ))}
              </ul>
            )}
          </Card>

          {done.length > 0 && (
            <Card title={t('done')} icon={<CheckCheck aria-hidden="true" className="size-5" />}>
              <ul className="flex flex-col gap-2">
                {done.map((task) => (
                  <TaskItem key={task.id} task={task} members={members} />
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card
          title={t('leaderboard')}
          icon={<Trophy aria-hidden="true" className="size-5" />}
          className="self-start"
        >
          <PointsBoard members={members} totals={totals} />
        </Card>
      </div>
    </div>
  );
}
