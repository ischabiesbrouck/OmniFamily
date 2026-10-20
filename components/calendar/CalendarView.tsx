'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTimeZone, useTranslations, type DateTimeFormatOptions } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  isView,
  shiftAnchor,
  VIEWS,
  visibleDates,
  windowFor,
  type CalendarView as View,
} from '@/lib/calendar/grid';
import { useMembers } from '@/lib/db/repositories/hooks';
import { progressFor, type TaskProgress } from '@/lib/db/repositories/tasks';
import type { FamilyMember } from '@/lib/db/schema';
import { occurrencesOnDay, type Occurrence } from '@/lib/recurrence/expand';
import { floatingDateToUtc, parseFloatingDate, todayIn, type FloatingDate } from '@/lib/time/zoned';
import { useDeviceStore } from '@/stores/deviceStore';
import { DayAgenda } from './DayAgenda';
import type { EditorState } from './EventDialog';
import { LazyEventDialog as EventDialog } from './LazyEventDialog';
import { OccurrenceChip } from './OccurrenceChip';
import { useOccurrences, useTaskProgress } from './useOccurrences';

const MONTH_CELL_LIMIT = 3;

function validDate(value: string | null): FloatingDate | undefined {
  if (!value) return undefined;
  try {
    parseFloatingDate(value);
    return value;
  } catch {
    return undefined;
  }
}

export function CalendarView() {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const zone = useTimeZone() ?? 'UTC';
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const members = useMembers() ?? [];
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
  const [editor, setEditor] = useState<EditorState>(null);

  const today = todayIn(zone);
  const view: View = isView(params.get('view')) ? (params.get('view') as View) : 'month';
  const anchor = validDate(params.get('date')) ?? today;
  const window = useMemo(() => windowFor(view, anchor, zone), [view, anchor, zone]);
  const occurrences = useOccurrences(window, zone, activeMemberId) ?? [];
  const progress = useTaskProgress();

  const navigate = (nextView: View, nextAnchor: FloatingDate) =>
    router.replace(`${pathname}?view=${nextView}&date=${nextAnchor}`, { scroll: false });
  const open = (occurrence: Occurrence) => setEditor({ mode: 'edit', occurrence });
  // Floating dates are formatted as UTC midnight in UTC, so no zone can shift the day.
  const label = (date: FloatingDate, options: DateTimeFormatOptions) =>
    format.dateTime(floatingDateToUtc(date), { ...options, timeZone: 'UTC' });
  const newEventDate =
    view === 'month' && anchor.slice(0, 7) === today.slice(0, 7) ? today : anchor;

  const dates = visibleDates(view, anchor);
  const heading =
    view === 'month'
      ? label(anchor, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${label(dates[0] ?? anchor, { day: 'numeric', month: 'short' })} – ${label(dates[6] ?? anchor, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : label(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold" aria-live="polite">
          {heading}
        </h1>
        <Button
          variant="secondary"
          aria-label={t('previous')}
          onClick={() => navigate(view, shiftAnchor(anchor, view, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button variant="secondary" onClick={() => navigate(view, today)}>
          {t('today')}
        </Button>
        <Button
          variant="secondary"
          aria-label={t('next')}
          onClick={() => navigate(view, shiftAnchor(anchor, view, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <div
          role="group"
          aria-label={t('views.label')}
          className="flex rounded-lg border border-ink/30"
        >
          {VIEWS.map((v) => (
            <Button
              key={v}
              variant={v === view ? 'primary' : 'ghost'}
              aria-pressed={v === view}
              onClick={() => navigate(v, anchor)}
            >
              {t(`views.${v}`)}
            </Button>
          ))}
        </div>
        <Button onClick={() => setEditor({ mode: 'new', date: newEventDate })}>
          {t('newEvent')}
        </Button>
      </div>

      {view === 'day' ? (
        <DayAgenda
          occurrences={occurrencesOnDay(occurrences, anchor, zone)}
          members={members}
          onOpen={open}
          progress={progress}
        />
      ) : (
        <Grid
          view={view}
          dates={dates}
          anchor={anchor}
          today={today}
          zone={zone}
          occurrences={occurrences}
          members={members}
          onOpen={open}
          progress={progress}
          onOpenDay={(date) => navigate('day', date)}
          label={label}
          more={(count) => t('more', { count })}
          openDayLabel={(date) =>
            t('openDay', { date: label(date, { weekday: 'long', day: 'numeric', month: 'long' }) })
          }
        />
      )}

      <EventDialog
        state={editor}
        members={members}
        timeZone={zone}
        activeMemberId={activeMemberId}
        onClose={() => setEditor(null)}
      />
    </div>
  );
}

function Grid({
  view,
  dates,
  anchor,
  today,
  zone,
  occurrences,
  members,
  onOpen,
  progress,
  onOpenDay,
  label,
  more,
  openDayLabel,
}: {
  view: 'month' | 'week';
  dates: FloatingDate[];
  anchor: FloatingDate;
  today: FloatingDate;
  zone: string;
  occurrences: Occurrence[];
  members: readonly FamilyMember[];
  onOpen: (o: Occurrence) => void;
  progress: Map<string, TaskProgress>;
  onOpenDay: (date: FloatingDate) => void;
  label: (date: FloatingDate, options: DateTimeFormatOptions) => string;
  more: (count: number) => string;
  openDayLabel: (date: FloatingDate) => string;
}) {
  const month = anchor.slice(0, 7);
  return (
    <div className="overflow-x-auto">
      <div role="grid" className="grid min-w-[42rem] grid-cols-7 gap-px rounded-lg bg-ink/15 p-px">
        <div role="row" className="contents">
          {dates.slice(0, 7).map((d) => (
            <div
              key={d}
              role="columnheader"
              className="bg-surface p-2 text-center text-sm font-semibold"
            >
              {label(d, { weekday: 'short' })}
            </div>
          ))}
        </div>
        {Array.from({ length: dates.length / 7 }, (_, row) => (
          <div key={row} role="row" className="contents">
            {dates.slice(row * 7, row * 7 + 7).map((d) => {
              const day = occurrencesOnDay(occurrences, d, zone);
              const shown = view === 'month' ? day.slice(0, MONTH_CELL_LIMIT) : day;
              const outside = view === 'month' && d.slice(0, 7) !== month;
              return (
                <div
                  key={d}
                  role="gridcell"
                  className={`flex flex-col gap-1 bg-surface p-1 ${view === 'month' ? 'min-h-32' : 'min-h-64'} ${outside ? 'text-muted' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenDay(d)}
                    aria-label={openDayLabel(d)}
                    aria-current={d === today ? 'date' : undefined}
                    className="inline-flex size-12 items-center justify-center self-start rounded-full font-semibold hover:bg-ink/10 aria-[current=date]:bg-ink aria-[current=date]:text-surface"
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
                      compact
                    />
                  ))}
                  {day.length > shown.length && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(d)}
                      className="min-h-12 text-left text-sm font-medium underline"
                    >
                      {more(day.length - shown.length)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
