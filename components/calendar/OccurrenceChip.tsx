'use client';

import { useFormatter, useTimeZone, useTranslations } from 'next-intl';
import type { FamilyMember } from '@/lib/db/schema';
import type { Occurrence } from '@/lib/recurrence/expand';

export function OccurrenceChip({
  occurrence,
  members,
  onOpen,
  compact = false,
}: {
  occurrence: Occurrence;
  members: readonly FamilyMember[];
  onOpen: (occurrence: Occurrence) => void;
  compact?: boolean;
}) {
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
      className="bg-ink/5 hover:bg-ink/10 focus-visible:outline-focus flex min-h-12 w-full items-center gap-2 rounded-md border-l-4 px-2 text-left text-sm focus-visible:outline-2"
      style={{ borderLeftColor: color }}
    >
      <span className="shrink-0 font-medium tabular-nums">{when}</span>
      <span className="truncate">{occurrence.event.title}</span>
    </button>
  );
}
