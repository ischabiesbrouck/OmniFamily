import {
  isValidTimeZone,
  parseFloatingDate,
  parseWallTime,
  zonedToInstant,
  type FloatingDate,
  type WallTime,
} from '@/lib/time/zoned';
import type { FamilyEvent, FamilyTask, PointsLedgerEntry } from '../schema';
import { RecordNotFoundError, type RepositoryCore, type Writer } from './core';

/** Date-only tasks are due at the end of that day in their zone (D-4.2). */
export const END_OF_DAY: WallTime = '23:59';

export interface TaskDraft {
  title: string;
  dueDate?: FloatingDate | undefined;
  dueTime?: WallTime | undefined;
  timeZone: string;
  assigneeId?: string | undefined;
  pointsValue?: number | undefined;
  eventId?: string | undefined;
}

export type TaskDraftError = 'titleRequired' | 'invalidDue' | 'invalidPoints';

export function validateTaskDraft(draft: TaskDraft): TaskDraftError | undefined {
  if (draft.title.trim() === '') return 'titleRequired';
  if (draft.dueDate) {
    try {
      parseFloatingDate(draft.dueDate);
      if (draft.dueTime) parseWallTime(draft.dueTime);
      if (!isValidTimeZone(draft.timeZone)) return 'invalidDue';
    } catch {
      return 'invalidDue';
    }
  }
  const p = draft.pointsValue;
  if (p !== undefined && (!Number.isInteger(p) || p < 0 || p > 1_000)) return 'invalidPoints';
  return undefined;
}

function linkIds(ids: readonly string[] | undefined, id: string, linked: boolean): string[] {
  const set = new Set(ids ?? []);
  if (linked) set.add(id);
  else set.delete(id);
  return [...set];
}

/** Keeps `FamilyEvent.linkedTaskIds` in step with `FamilyTask.eventId` (same transaction). */
async function relinkEvent(
  w: Writer,
  eventId: string | undefined,
  taskId: string,
  linked: boolean,
) {
  if (!eventId) return;
  const event = await w.get('event', eventId);
  if (!event || event.deletedAt !== undefined) return;
  const next = linkIds(event.linkedTaskIds, taskId, linked);
  if (next.length !== (event.linkedTaskIds ?? []).length)
    await w.update('event', eventId, { linkedTaskIds: next });
}

export function createTask(core: RepositoryCore, draft: TaskDraft): Promise<FamilyTask> {
  return core.write(['task', 'event'], async (w) => {
    const dueInstant = draft.dueDate
      ? zonedToInstant(draft.dueDate, draft.dueTime || END_OF_DAY, draft.timeZone)
      : undefined;
    const task = await w.insert('task', {
      title: draft.title.trim(),
      completed: false,
      dueInstant,
      timeZone: dueInstant ? draft.timeZone : undefined,
      assigneeId: draft.assigneeId || undefined,
      pointsValue: draft.pointsValue || undefined,
      eventId: draft.eventId || undefined,
    });
    await relinkEvent(w, task.eventId, task.id, true);
    return task;
  });
}

/**
 * Completes or reopens a task. Completing a task with points appends a `task_completed`
 * ledger entry for its assignee (or whoever ticked it); reopening appends the reversal.
 * The ledger is append-only, so a balance is always the sum of its entries (D-4.1).
 */
export function setTaskCompleted(
  core: RepositoryCore,
  taskId: string,
  completed: boolean,
  byMemberId: string | undefined,
): Promise<{ task: FamilyTask; ledger?: PointsLedgerEntry }> {
  return core.write(['task', 'points'], async (w) => {
    const task = await w.get('task', taskId);
    if (!task || task.deletedAt !== undefined) throw new RecordNotFoundError('task', taskId);
    if (task.completed === completed) return { task };

    const generation = (task.completionGen ?? 0) + 1;
    const updated = await w.update(
      'task',
      taskId,
      {
        completed,
        completedAt: completed ? w.now : undefined,
        completedBy: completed ? byMemberId : undefined,
        completionGen: generation,
      },
      ['completedHlc'],
    );

    const points = task.pointsValue ?? 0;
    const memberId = completed
      ? (task.assigneeId ?? byMemberId)
      : (task.assigneeId ?? task.completedBy);
    if (points <= 0 || !memberId) return { task: updated };

    // Deterministic id: two devices completing the same chore while apart produce the SAME
    // entry, which merges by LWW instead of paying out twice (D-6.4).
    const ledgerId = `${taskId}:${generation}`;
    if (await w.get('points', ledgerId)) return { task: updated };
    const ledger = await w.insert('points', {
      id: ledgerId,
      memberId,
      delta: completed ? points : -points,
      reason: 'task_completed',
      taskId,
    });
    return { task: updated, ledger };
  });
}

export function updateTask(
  core: RepositoryCore,
  task: FamilyTask,
  draft: TaskDraft,
): Promise<FamilyTask> {
  return core.write(['task', 'event'], async (w) => {
    const dueInstant = draft.dueDate
      ? zonedToInstant(draft.dueDate, draft.dueTime || END_OF_DAY, draft.timeZone)
      : undefined;
    const updated = await w.update('task', task.id, {
      title: draft.title.trim(),
      dueInstant,
      timeZone: dueInstant ? draft.timeZone : undefined,
      assigneeId: draft.assigneeId || undefined,
      pointsValue: draft.pointsValue || undefined,
      eventId: draft.eventId || undefined,
    });
    if (task.eventId !== updated.eventId) {
      await relinkEvent(w, task.eventId, task.id, false);
      await relinkEvent(w, updated.eventId, task.id, true);
    }
    return updated;
  });
}

export function deleteTask(core: RepositoryCore, taskId: string): Promise<void> {
  return core.write(['task', 'event'], async (w) => {
    const removed = await w.remove('task', taskId);
    await relinkEvent(w, removed.eventId, taskId, false);
  });
}

export interface TaskProgress {
  done: number;
  total: number;
}

/** Badge data for each event: how many of its linked tasks are done. */
export function taskProgressByEvent(tasks: readonly FamilyTask[]): Map<string, TaskProgress> {
  const progress = new Map<string, TaskProgress>();
  for (const task of tasks) {
    if (!task.eventId || task.deletedAt !== undefined) continue;
    const p = progress.get(task.eventId) ?? { done: 0, total: 0 };
    p.total += 1;
    if (task.completed) p.done += 1;
    progress.set(task.eventId, p);
  }
  return progress;
}

/** For a recurring series, tasks link to the master; overrides look up their series. */
export function progressFor(
  event: FamilyEvent,
  progress: Map<string, TaskProgress>,
): TaskProgress | undefined {
  return (
    progress.get(event.id) ??
    (event.recurrenceParentId ? progress.get(event.recurrenceParentId) : undefined)
  );
}
