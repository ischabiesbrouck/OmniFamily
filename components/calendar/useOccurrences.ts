'use client';

import { useMemo } from 'react';
import { isVisibleTo } from '@/lib/calendar/grid';
import { useLiveEvents, useLiveRecords } from '@/lib/db/repositories/hooks';
import { taskProgressByEvent, type TaskProgress } from '@/lib/db/repositories/tasks';
import { occurrencesInWindow, type Occurrence, type Window } from '@/lib/recurrence/expand';

/** Visible occurrences in a window; recomputed whenever IndexedDB changes (useLiveQuery). */
export function useOccurrences(
  window: Window,
  zone: string,
  activeMemberId: string | null,
): Occurrence[] | undefined {
  const events = useLiveEvents();
  return useMemo(
    () =>
      events &&
      occurrencesInWindow(events, window, zone).filter((o) => isVisibleTo(o, activeMemberId)),
    [events, window, zone, activeMemberId],
  );
}

/** Linked-task progress per event id, for the occurrence badges. */
export function useTaskProgress(): Map<string, TaskProgress> {
  const tasks = useLiveRecords('task');
  return useMemo(() => taskProgressByEvent(tasks ?? []), [tasks]);
}
