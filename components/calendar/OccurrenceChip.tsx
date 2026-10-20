'use client';

import { useFormatter, useTimeZone, useTranslations } from 'next-intl';
import type { TaskProgress } from '@/lib/db/repositories/tasks';
import type { FamilyMember } from '@/lib/db/schema';
import type { Occurrence } from '@/lib/recurrence/expand';

export function occurrenceColor(occurrence: Occurrence, members: readonly FamilyMember[]): string {
  return (
    members.find((m) => occurrence.event.memberIds.includes(m.id))?.colorHex ?? 'var(--accent)'
  );
}

export function useTimeLabel() {
  const format = useFormatter();
  const zone = useTimeZone() ?? 'UTC';
  return (ms: number) =>
    format.dateTime(new Date(ms), { hour: '2-digit', minute: '2-digit', timeZone: zone });
}

export function ProgressBadge({ progress }: { progress: TaskProgress | undefined }) {
  const t = useTranslations('linked');
  if (!progress) return null;
  const done = progress.done === progress.total;
  return (
    <span
      className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${done ? 'bg-success-soft text-success' : 'bg-surface text-ink ring-1 ring-line-strong'}`}
    >
      <span aria-hidden="true">
        {progress.done}/{progress.total}
      </span>
      <span className="sr-only">{t('badge', { done: progress.done, total: progress.total })}</span>
    </span>
  );
}

/** Compact event pill (month cells). The accessible name reads "19:00 Swimming". */
export function OccurrenceChip({
  occurrence,
  members,
  onOpen,
  progress,
  compact = true,
}: {
  occurrence: Occurrence;
  members: readonly FamilyMember[];
  onOpen: (occurrence: Occurrence) => void;
  progress?: TaskProgress | undefined;
  compact?: boolean;
}) {
  const t = useTranslations('calendar');
  const time = useTimeLabel();
  const color = occurrenceColor(occurrence, members);
  return (
    <button
      type="button"
      onClick={() => onOpen(occurrence)}
      className="flex min-h-12 w-full items-center gap-1.5 rounded-lg bg-surface-2 px-2 text-left text-sm hover:brightness-95 lg:pointer-fine:min-h-8"
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="shrink-0 font-semibold tabular-nums">
        {occurrence.isAllDay
          ? t('allDay')
          : compact
            ? time(occurrence.start)
            : t('timeRange', { start: time(occurrence.start), end: time(occurrence.end) })}
      </span>
      <span className="truncate">{occurrence.event.title}</span>
      <ProgressBadge progress={progress} />
    </button>
  );
}
