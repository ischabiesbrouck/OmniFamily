'use client';

import { useTranslations, type DateTimeFormatOptions } from 'next-intl';
import type { FloatingDate } from '@/lib/time/zoned';

/**
 * A week as a row of day bubbles (the Today hero and the phone day view). The picked day is a
 * solid bubble, today has a ring, and a dot marks days with something planned. Each name is
 * the visible "M 19" plus a hidden "– Open Monday 19 October" (SC 2.5.3).
 */
export function WeekStrip({
  dates,
  selected,
  today,
  busy,
  label,
  onPick,
  className = '',
}: {
  dates: readonly FloatingDate[];
  selected: FloatingDate | null;
  today: FloatingDate;
  busy: ReadonlySet<FloatingDate>;
  label: (date: FloatingDate, options: DateTimeFormatOptions) => string;
  onPick: (date: FloatingDate) => void;
  className?: string;
}) {
  const t = useTranslations('calendar');
  return (
    <div className={`grid grid-cols-7 sm:gap-1 ${className}`}>
      {dates.map((d) => {
        const picked = d === selected;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onPick(d)}
            aria-pressed={picked}
            aria-current={d === today ? 'date' : undefined}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-full"
          >
            <span className="text-xs font-semibold uppercase">
              {label(d, { weekday: 'narrow' })}
            </span>{' '}
            <span
              className={`flex size-10 items-center justify-center rounded-full text-base font-semibold tabular-nums transition ${
                picked ? 'bg-surface text-ink shadow-card' : ''
              } ${d === today && !picked ? 'ring-2 ring-ink/70' : ''}`}
            >
              {label(d, { day: 'numeric' })}
            </span>
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${busy.has(d) ? 'bg-ink' : 'bg-transparent'}`}
            />
            <span className="sr-only">
              {' – '}
              {t('openDay', { date: label(d, { weekday: 'long', day: 'numeric', month: 'long' }) })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
