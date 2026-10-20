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
  const dates = monthGrid(anchor);
  const month = anchor.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="grid grid-cols-7 border-b border-line">
        {dates.slice(0, 7).map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted uppercase">
            {label(d, { weekday: compact ? 'narrow' : 'short' })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((d, i) => {
          const day = occurrencesOnDay(occurrences, d, zone);
          const outside = d.slice(0, 7) !== month;
          const dayLabel = t('openDay', {
            date: label(d, { weekday: 'long', day: 'numeric', month: 'long' }),
          });
          const number = (
            <span
              className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${d === today ? 'bg-accent text-on-accent' : ''} ${compact && d === anchor && d !== today ? 'ring-2 ring-accent' : ''}`}
            >
              {label(d, { day: 'numeric' })}
            </span>
          );
          const border = `${i % 7 !== 0 ? 'border-l' : ''} ${i >= 7 ? 'border-t' : ''} border-line`;

          if (compact) {
            return (
              <button
                key={d}
                type="button"
                onClick={() => onPickDay(d)}
                aria-label={dayLabel}
                aria-pressed={d === anchor}
                aria-current={d === today ? 'date' : undefined}
                className={`flex min-h-14 flex-col items-center gap-1 py-1 ${border} ${outside ? 'bg-canvas text-muted' : ''}`}
              >
                {number}
                <span className="flex gap-0.5" aria-hidden="true">
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
              className={`flex min-h-32 flex-col gap-1 p-1 ${border} ${outside ? 'bg-canvas' : ''}`}
            >
              <button
                type="button"
                onClick={() => onPickDay(d)}
                aria-label={dayLabel}
                aria-current={d === today ? 'date' : undefined}
                className={`inline-flex size-12 items-center justify-center self-start rounded-full hover:bg-surface-2 ${outside ? 'text-muted' : ''}`}
              >
                {number}
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
                  className="min-h-12 rounded-lg px-2 text-left text-sm font-semibold text-accent hover:bg-surface-2 lg:pointer-fine:min-h-8"
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
