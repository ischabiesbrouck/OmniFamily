'use client';

import { Trash2 } from 'lucide-react';
import { useFormatter, useTimeZone, useTranslations } from 'next-intl';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { Button } from '@/components/ui/Button';
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
}: {
  task: FamilyTask;
  members: readonly FamilyMember[];
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

  return (
    <li className="flex items-center gap-2 rounded-lg border border-ink/15 pr-2">
      <Checkbox
        checked={completed}
        aria-label={
          task.completed
            ? t('markOpen', { title: task.title })
            : t('markDone', { title: task.title })
        }
        onChange={(e) => setCompleted(e.target.checked)}
      />
      <div className="flex min-w-0 flex-1 flex-col py-2">
        <span className={`font-medium ${completed ? 'text-muted line-through' : ''}`}>
          {task.title}
        </span>
        <span className="flex flex-wrap gap-x-3 text-sm text-muted">
          {due !== undefined && (
            <span className={!completed && due < Date.now() ? 'font-semibold text-danger' : ''}>
              {t('dueOn', {
                date: format.dateTime(new Date(due), { dateStyle: 'medium', timeZone: zone }),
              })}
            </span>
          )}
          {task.pointsValue ? <span>{t('pointsValue', { points: task.pointsValue })}</span> : null}
        </span>
      </div>
      {assignee && <MemberAvatar member={assignee} size="sm" />}
      <Button
        variant="ghost"
        aria-label={t('delete', { title: task.title })}
        onClick={() => void deleteTask(core, task.id)}
      >
        <Trash2 aria-hidden="true" className="size-5" />
      </Button>
    </li>
  );
}
