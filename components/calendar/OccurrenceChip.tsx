'use client';

import { useFormatter, useTimeZone, useTranslations } from 'next-intl';
import type { FamilyMember } from '@/lib/db/schema';
import type { TaskProgress } from '@/lib/db/repositories/tasks';
import type { Occurrence } from '@/lib/recurrence/expand';

export function OccurrenceChip({
  occurrence,
  members,
  onOpen,
  compact = false,
  progress,
}: {
  occurrence: Occurrence;
  members: readonly FamilyMember[];
  onOpen: (occurrence: Occurrence) => void;
  compact?: boolean;
  progress?: TaskProgress | undefined;
}) {
  const tLinked = useTranslations('linked');
  const t = useTranslations('calendar');
  const format = useFormatter();
  const timeZone = useTimeZone() ?? 'UTC';
  const color =
    members.find((m) => occurrence.event.memberIds.includes(m.id))?.colorHex ?? '#334155';
  const time = (ms: number) =>
    format.dateTime(new Date(ms), { hour: '2-digit', minute: '2-digit', timeZone });
  const when = occurrence.isAllDay
    ? t('allDay')
    : compact
      ? time(occurrence.start)
      : t('timeRange', { start: time(occurrence.start), end: time(occurrence.end) });

  return (
    <button
      type="button"
      onClick={() => onOpen(occurrence)}
      className="flex min-h-12 w-full items-center gap-2 rounded-md border-l-4 bg-ink/5 px-2 text-left text-sm hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-focus"
      style={{ borderLeftColor: color }}
    >
      <span className="shrink-0 font-medium tabular-nums">{when}</span>
      <span className="truncate">{occurrence.event.title}</span>
      {progress && (
        <span
          className={`ml-auto shrink-0 rounded-full px-2 text-xs font-semibold ${progress.done === progress.total ? 'bg-ink text-surface' : 'border border-ink/40'}`}
        >
          <span aria-hidden="true">
            {progress.done}/{progress.total}
          </span>
          <span className="sr-only">
            {tLinked('badge', { done: progress.done, total: progress.total })}
          </span>
        </span>
      )}
    </button>
  );
}
