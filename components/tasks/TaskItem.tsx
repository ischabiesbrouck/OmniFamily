'use client';

import { CalendarClock, Star, Trash2 } from 'lucide-react';
import { useFormatter, useTimeZone, useTranslations } from 'next-intl';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { IconButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useOptimisticToggle } from '@/components/ui/useOptimisticToggle';
import { getRepositories } from '@/lib/db/repositories';
import { deleteTask, setTaskCompleted } from '@/lib/db/repositories/tasks';
import type { FamilyMember, FamilyTask } from '@/lib/db/schema';
import { instantToEpoch } from '@/lib/time/zoned';
import { useDeviceStore } from '@/stores/deviceStore';

export function TaskItem({
  task,
  members,
  hideDelete = false,
}: {
  task: FamilyTask;
  members: readonly FamilyMember[];
  /** The wall display lets anyone tick chores but not delete them. */
  hideDelete?: boolean;
}) {
  const t = useTranslations('tasks');
  const format = useFormatter();
  const zone = useTimeZone() ?? 'UTC';
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
  const assignee = members.find((m) => m.id === task.assigneeId);
  const core = getRepositories().core;
  const due = task.dueInstant ? instantToEpoch(task.dueInstant) : undefined;
  const [completed, setCompleted] = useOptimisticToggle(task.completed, (next) =>
    setTaskCompleted(core, task.id, next, activeMemberId ?? undefined),
  );
  const overdue = !completed && due !== undefined && due < Date.now();

  return (
    <li className="flex items-center gap-1 rounded-xl bg-surface-2 pr-1 transition">
      <Checkbox
        checked={completed}
        aria-label={
          completed ? t('markOpen', { title: task.title }) : t('markDone', { title: task.title })
        }
        onChange={(e) => setCompleted(e.target.checked)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-2.5">
        <span className={`font-semibold ${completed ? 'text-muted line-through' : ''}`}>
          {task.title}
        </span>
        {(due !== undefined || task.pointsValue) && (
          <span className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {due !== undefined && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${overdue ? 'bg-danger-soft text-danger' : 'bg-surface text-muted'}`}
              >
                <CalendarClock aria-hidden="true" className="size-3.5" />
                {t('dueOn', {
                  date: format.dateTime(new Date(due), { dateStyle: 'medium', timeZone: zone }),
                })}
              </span>
            )}
            {task.pointsValue ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-warning">
                <Star aria-hidden="true" className="size-3.5" />
                {t('pointsValue', { points: task.pointsValue })}
              </span>
            ) : null}
          </span>
        )}
      </div>
      {assignee && <MemberAvatar member={assignee} size="sm" />}
      {!hideDelete && (
        <IconButton
          label={t('delete', { title: task.title })}
          onClick={() => void deleteTask(core, task.id)}
        >
          <Trash2 aria-hidden="true" className="size-5" />
        </IconButton>
      )}
    </li>
  );
}
