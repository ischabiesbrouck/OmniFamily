'use client';

import { useFormatter, useTimeZone, useTranslations, type DateTimeFormatOptions } from 'next-intl';
import Link from 'next/link';
import { monthGrid } from '@/lib/calendar/grid';
import { floatingDateToUtc, todayIn, type FloatingDate } from '@/lib/time/zoned';

/** Sidebar month at a glance (large screens); every day opens that day in the calendar. */
export function MiniMonth() {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const zone = useTimeZone() ?? 'UTC';
  const today = todayIn(zone);
  const dates = monthGrid(today);
  const month = today.slice(0, 7);
  const label = (d: FloatingDate, options: DateTimeFormatOptions) =>
    format.dateTime(floatingDateToUtc(d), { ...options, timeZone: 'UTC' });

  return (
    <div className="rounded-tile bg-surface-2 p-3">
      <p className="mb-2 px-1 font-semibold first-letter:uppercase">
        {label(today, { month: 'long', year: 'numeric' })}
      </p>
      <div className="grid grid-cols-7 text-center text-[0.7rem] font-semibold text-muted">
        {dates.slice(0, 7).map((d) => (
          <span key={d} aria-hidden="true">
            {label(d, { weekday: 'narrow' })}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7">
        {dates.map((d) => (
          <Link
            key={d}
            href={`/calendar?view=day&date=${d}`}
            aria-label={t('openDay', {
              date: label(d, { weekday: 'long', day: 'numeric', month: 'long' }),
            })}
            aria-current={d === today ? 'date' : undefined}
            className={`mx-auto flex size-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums hover:bg-surface aria-[current=date]:bg-accent aria-[current=date]:text-on-accent ${
              d.slice(0, 7) !== month ? 'text-muted' : ''
            }`}
          >
            {label(d, { day: 'numeric' })}
          </Link>
        ))}
      </div>
    </div>
  );
}
