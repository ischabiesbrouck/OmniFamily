'use client';

import { useMemo } from 'react';
import { isVisibleTo } from '@/lib/calendar/grid';
import { useLiveEvents } from '@/lib/db/repositories/hooks';
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
