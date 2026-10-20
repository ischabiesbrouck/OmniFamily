'use client';

import { useFormatter, useTimeZone, useTranslations, type DateTimeFormatOptions } from 'next-intl';
import { useEffect, useRef } from 'react';
import { DAY_MINUTES, layoutDay } from '@/lib/calendar/layout';
import { progressFor, type TaskProgress } from '@/lib/db/repositories/tasks';
import type { FamilyMember } from '@/lib/db/schema';
import { occurrencesOnDay, type Occurrence } from '@/lib/recurrence/expand';
import {
  addDays,
  epochToWallClock,
  floatingDateToUtc,
  startOfDayEpoch,
  type FloatingDate,
} from '@/lib/time/zoned';
import { OccurrenceChip, occurrenceColor, ProgressBadge, useTimeLabel } from './OccurrenceChip';

const HOUR_PX = 56;
const PX_PER_MIN = HOUR_PX / 60;

function wallMinutes(ms: number, zone: string): number {
  const w = epochToWallClock(ms, zone);
  return w.hour * 60 + w.minute;
}

/** Day/week time grid: hour rows, all-day lane, overlap columns and a "now" line. */
export function TimeGrid({
  dates,
  today,
  now,
  occurrences,
  members,
  progress,
  onOpen,
  onOpenDay,
  onCreateAt,
}: {
  dates: readonly FloatingDate[];
  today: FloatingDate;
  now: number;
  occurrences: readonly Occurrence[];
  members: readonly FamilyMember[];
  progress: Map<string, TaskProgress>;
  onOpen: (o: Occurrence) => void;
  onOpenDay?: (date: FloatingDate) => void;
  onCreateAt: (date: FloatingDate, hour: number) => void;
}) {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const zone = useTimeZone() ?? 'UTC';
  const time = useTimeLabel();
  const scroller = useRef<HTMLDivElement>(null);

  const datesKey = dates.join();
  useEffect(() => {
    // Open on the working day, or on the first event if it starts earlier.
    const first = occurrences.filter((o) => !o.isAllDay).map((o) => wallMinutes(o.start, zone));
    const startHour = Math.max(0, Math.min(7, ...first.map((m) => Math.floor(m / 60))));
    if (scroller.current) scroller.current.scrollTop = startHour * HOUR_PX;
    // Only on mount / date change: re-scrolling while someone reads would be jarring.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: occurrences excluded
  }, [datesKey, zone]);

  const label = (date: FloatingDate, options: DateTimeFormatOptions) =>
    format.dateTime(floatingDateToUtc(date), { ...options, timeZone: 'UTC' });
  const cols = dates.length;
  const gridCols = { gridTemplateColumns: `3.5rem repeat(${cols}, minmax(0, 1fr))` };
  const nowMin = wallMinutes(now, zone);

  const perDay = dates.map((date) => {
    const dayStart = startOfDayEpoch(date, zone);
    const dayEnd = startOfDayEpoch(addDays(date, 1), zone);
    const on = occurrencesOnDay(occurrences, date, zone);
    const timed = on
      .filter((o) => !o.isAllDay)
      .map((o) => ({
        o,
        startMin: o.start <= dayStart ? 0 : wallMinutes(o.start, zone),
        endMin: o.end >= dayEnd ? DAY_MINUTES : wallMinutes(o.end, zone),
      }));
    return { date, allDay: on.filter((o) => o.isAllDay), placed: layoutDay(timed, 24) };
  });
  const hasAllDay = perDay.some((d) => d.allDay.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {cols > 1 && (
        <div className="grid border-b border-line" style={gridCols}>
          <span />
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onOpenDay?.(d)}
              aria-current={d === today ? 'date' : undefined}
              className="group flex min-h-12 flex-col items-center justify-center py-1 hover:bg-surface-2"
            >
              {/* SC 2.5.3: the name is the visible "Mon 19" plus a hidden "– Open Monday 19 October". */}
              <span className="text-xs font-semibold text-muted uppercase">
                {label(d, { weekday: 'short' })}
              </span>{' '}
              <span className="flex size-8 items-center justify-center rounded-full text-lg font-bold group-aria-[current=date]:bg-accent group-aria-[current=date]:text-on-accent">
                {label(d, { day: 'numeric' })}
              </span>
              <span className="sr-only">
                {' – '}
                {t('openDay', {
                  date: label(d, { weekday: 'long', day: 'numeric', month: 'long' }),
                })}
              </span>
            </button>
          ))}
        </div>
      )}

      {hasAllDay && (
        <div className="grid border-b border-line" style={gridCols}>
          <span className="self-center px-1 text-center text-xs font-semibold text-muted">
            {t('allDay')}
          </span>
          {perDay.map((d) => (
            <div key={d.date} className="flex flex-col gap-1 border-l border-line p-1">
              {d.allDay.map((o) => (
                <OccurrenceChip
                  key={o.key}
                  occurrence={o}
                  members={members}
                  onOpen={onOpen}
                  progress={progressFor(o.event, progress)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scroller} className="relative max-h-[min(70dvh,44rem)] overflow-y-auto">
        <div className="grid" style={{ ...gridCols, height: 24 * HOUR_PX }}>
          <div className="relative">
            {Array.from({ length: 23 }, (_, h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-xs font-medium text-muted tabular-nums"
                style={{ top: (h + 1) * HOUR_PX }}
              >
                {format.dateTime(Date.UTC(2000, 0, 1, h + 1), {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })}
              </span>
            ))}
          </div>
          {perDay.map((d) => (
            <div key={d.date} className="relative border-l border-line">
              {Array.from({ length: 24 }, (_, h) => (
                <button
                  key={h}
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => onCreateAt(d.date, h)}
                  className="absolute inset-x-0 border-t border-line/70 hover:bg-surface-2/60"
                  style={{ top: h * HOUR_PX, height: HOUR_PX }}
                />
              ))}
              {d.date === today && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10"
                  style={{ top: nowMin * PX_PER_MIN }}
                >
                  <div className="relative h-0.5 bg-now">
                    <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-now" />
                  </div>
                </div>
              )}
              {d.placed.map(({ item, top, height, column, columns }) => (
                <button
                  key={item.o.key}
                  type="button"
                  onClick={() => onOpen(item.o)}
                  className="absolute z-[5] flex flex-col overflow-hidden rounded-lg border-l-4 bg-accent-soft px-1.5 py-1 text-left text-xs text-accent-soft-ink shadow-card hover:brightness-95"
                  style={{
                    top: top * PX_PER_MIN + 1,
                    height: Math.max(height * PX_PER_MIN - 2, 22),
                    left: `calc(${(100 / columns) * column}% + 2px)`,
                    width: `calc(${100 / columns}% - 4px)`,
                    borderLeftColor: occurrenceColor(item.o, members),
                  }}
                >
                  {/* Accessible name keeps "time – title" order; short blocks fit on one line. */}
                  <span
                    className={`flex min-w-0 gap-1 ${height < 45 ? 'items-center' : 'flex-col-reverse'}`}
                  >
                    <span className="truncate tabular-nums">
                      {t('timeRange', { start: time(item.o.start), end: time(item.o.end) })}
                    </span>
                    <span className="truncate text-sm font-bold">{item.o.event.title}</span>
                  </span>
                  <ProgressBadge progress={progressFor(item.o.event, progress)} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
