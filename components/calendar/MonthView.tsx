'use client';

import { useTranslations, type DateTimeFormatOptions } from 'next-intl';
import { monthGrid } from '@/lib/calendar/grid';
import { progressFor, type TaskProgress } from '@/lib/db/repositories/tasks';
import type { FamilyMember } from '@/lib/db/schema';
import { occurrencesOnDay, type Occurrence } from '@/lib/recurrence/expand';
import type { FloatingDate } from '@/lib/time/zoned';
import { OccurrenceChip, occurrenceColor } from './OccurrenceChip';

const CELL_LIMIT = 3;

export function MonthView({
  anchor,
  today,
  zone,
  occurrences,
  members,
  progress,
  compact,
  label,
  onOpen,
  onPickDay,
}: {
  anchor: FloatingDate;
  today: FloatingDate;
  zone: string;
  occurrences: readonly Occurrence[];
  members: readonly FamilyMember[];
  progress: Map<string, TaskProgress>;
  /** Phones: dots per day; the picked day's agenda shows below the grid. */
  compact: boolean;
  label: (date: FloatingDate, options: DateTimeFormatOptions) => string;
  onOpen: (o: Occurrence) => void;
  onPickDay: (date: FloatingDate) => void;
}) {
  const t = useTranslations('calendar');
  const month = anchor.slice(0, 7);
  // Weeks that lie wholly in another month add nothing; leave them out.
  const all = monthGrid(anchor);
  const dates = all.filter((_, i) => {
    const week = all.slice(i - (i % 7), i - (i % 7) + 7);
    return week.some((d) => d.slice(0, 7) === month);
  });

  return (
    <div className={compact ? 'rounded-card border border-line bg-surface p-3 shadow-card' : ''}>
      <div className={`grid grid-cols-7 ${compact ? 'gap-1' : 'mb-2 gap-2'}`}>
        {dates.slice(0, 7).map((d) => (
          <div
            key={d}
            className={`text-center text-xs font-semibold text-muted ${compact ? 'py-1' : 'rounded-full border border-line bg-surface py-1.5 uppercase'}`}
          >
            {label(d, { weekday: compact ? 'narrow' : 'short' })}
          </div>
        ))}
      </div>
      <div className={`grid grid-cols-7 ${compact ? 'gap-y-1' : 'gap-2'}`}>
        {dates.map((d) => {
          const day = occurrencesOnDay(occurrences, d, zone);
          const outside = d.slice(0, 7) !== month;
          const dayLabel = t('openDay', {
            date: label(d, { weekday: 'long', day: 'numeric', month: 'long' }),
          });

          if (compact) {
            const picked = d === anchor;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onPickDay(d)}
                aria-label={dayLabel}
                aria-pressed={picked}
                aria-current={d === today ? 'date' : undefined}
                className="flex min-h-14 flex-col items-center gap-1 pt-0.5"
              >
                <span
                  className={`flex size-10 items-center justify-center rounded-full text-[0.95rem] font-semibold tabular-nums transition ${
                    picked
                      ? 'bg-accent text-on-accent'
                      : outside
                        ? 'text-muted'
                        : 'bg-surface-2 text-ink'
                  } ${d === today && !picked ? 'ring-2 ring-brand' : ''}`}
                >
                  {label(d, { day: 'numeric' })}
                </span>
                <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                  {day.slice(0, 3).map((o) => (
                    <span
                      key={o.key}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: occurrenceColor(o, members) }}
                    />
                  ))}
                </span>
              </button>
            );
          }

          const shown = day.slice(0, CELL_LIMIT);
          return (
            <div
              key={d}
              className={`flex min-h-32 flex-col gap-1 rounded-tile p-1.5 ${
                outside ? 'border border-dashed border-line' : 'bg-surface shadow-card'
              } ${d === today ? 'ring-2 ring-brand' : ''}`}
            >
              <button
                type="button"
                onClick={() => onPickDay(d)}
                aria-label={dayLabel}
                aria-current={d === today ? 'date' : undefined}
                className={`inline-flex size-12 items-center justify-center self-start rounded-full text-sm font-semibold tabular-nums hover:bg-surface-2 lg:pointer-fine:size-9 ${
                  d === today
                    ? 'bg-accent text-on-accent hover:bg-accent'
                    : outside
                      ? 'text-muted'
                      : ''
                }`}
              >
                {label(d, { day: 'numeric' })}
              </button>
              {shown.map((o) => (
                <OccurrenceChip
                  key={o.key}
                  occurrence={o}
                  members={members}
                  onOpen={onOpen}
                  progress={progressFor(o.event, progress)}
                />
              ))}
              {day.length > shown.length && (
                <button
                  type="button"
                  onClick={() => onPickDay(d)}
                  className="min-h-12 rounded-xl px-2 text-left text-sm font-semibold text-ink underline-offset-2 hover:underline lg:pointer-fine:min-h-8"
                >
                  {t('more', { count: day.length - shown.length })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
