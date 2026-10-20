'use client';

import type { DateTimeFormatOptions } from 'next-intl';
import type { TaskProgress } from '@/lib/db/repositories/tasks';
import type { FamilyMember } from '@/lib/db/schema';
import { occurrencesOnDay, type Occurrence } from '@/lib/recurrence/expand';
import type { FloatingDate } from '@/lib/time/zoned';
import { DayAgenda } from './DayAgenda';

/** Phones: the week as a list of days (seven time-grid columns would be unreadable). */
export function WeekAgenda({
  dates,
  today,
  zone,
  occurrences,
  members,
  progress,
  label,
  onOpen,
}: {
  dates: readonly FloatingDate[];
  today: FloatingDate;
  zone: string;
  occurrences: readonly Occurrence[];
  members: readonly FamilyMember[];
  progress: Map<string, TaskProgress>;
  label: (date: FloatingDate, options: DateTimeFormatOptions) => string;
  onOpen: (o: Occurrence) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {dates.map((d) => (
        <section key={d} aria-label={label(d, { weekday: 'long', day: 'numeric', month: 'long' })}>
          <h2
            className={`mb-1.5 text-sm font-bold tracking-wide uppercase ${d === today ? 'text-accent' : 'text-muted'}`}
          >
            {label(d, { weekday: 'long', day: 'numeric', month: 'short' })}
          </h2>
          <DayAgenda
            occurrences={occurrencesOnDay(occurrences, d, zone)}
            members={members}
            progress={progress}
            onOpen={onOpen}
          />
        </section>
      ))}
    </div>
  );
}
