'use client';

import { useTranslations } from 'next-intl';
import type { FamilyMember } from '@/lib/db/schema';
import { progressFor, type TaskProgress } from '@/lib/db/repositories/tasks';
import type { Occurrence } from '@/lib/recurrence/expand';
import { OccurrenceChip } from './OccurrenceChip';

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
  if (occurrences.length === 0) return <p className="text-muted">{t('noEvents')}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {occurrences.map((o) => (
        <li key={o.key}>
          <OccurrenceChip
            occurrence={o}
            members={members}
            onOpen={onOpen}
            progress={progressFor(o.event, progress)}
          />
        </li>
      ))}
    </ul>
  );
}
