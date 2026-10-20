'use client';

import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { progressFor, type TaskProgress } from '@/lib/db/repositories/tasks';
import type { FamilyMember } from '@/lib/db/schema';
import type { Occurrence } from '@/lib/recurrence/expand';
import { occurrenceColor, ProgressBadge, useTimeLabel } from './OccurrenceChip';

/** Agenda list: time column, colour bar, title, place and people. Name: "19:00–20:00 Swimming". */
export function DayAgenda({
  occurrences,
  members,
  onOpen,
  progress,
}: {
  occurrences: readonly Occurrence[];
  members: readonly FamilyMember[];
  onOpen: (occurrence: Occurrence) => void;
  progress: Map<string, TaskProgress>;
}) {
  const t = useTranslations('calendar');
  const time = useTimeLabel();
  if (occurrences.length === 0) return <p className="py-2 text-muted">{t('noEvents')}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {occurrences.map((o) => {
        const people = members.filter((m) => o.event.memberIds.includes(m.id));
        return (
          <li key={o.key}>
            <button
              type="button"
              onClick={() => onOpen(o)}
              className="flex min-h-14 w-full items-stretch gap-3 rounded-xl bg-surface-2 p-2.5 text-left transition hover:brightness-95"
            >
              <span
                aria-hidden="true"
                className="w-1 shrink-0 rounded-full"
                style={{ backgroundColor: occurrenceColor(o, members) }}
              />
              <span className="w-24 shrink-0 text-sm font-semibold tabular-nums sm:w-28">
                {o.isAllDay
                  ? t('allDay')
                  : t('timeRange', { start: time(o.start), end: time(o.end) })}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{o.event.title}</span>
                {o.event.location && (
                  <span className="flex items-center gap-1 truncate text-sm text-muted">
                    <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                    {o.event.location}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="hidden -space-x-2 sm:flex">
                  {people.slice(0, 3).map((m) => (
                    <MemberAvatar key={m.id} member={m} size="sm" />
                  ))}
                </span>
                <ProgressBadge progress={progressFor(o.event, progress)} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
