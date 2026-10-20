'use client';

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useFormatter, useTimeZone, useTranslations, type DateTimeFormatOptions } from 'next-intl';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useMinuteClock } from '@/components/kiosk/hooks';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useMediaQuery } from '@/components/ui/useMediaQuery';
import {
  isView,
  shiftAnchor,
  VIEWS,
  visibleDates,
  windowFor,
  type CalendarView as View,
} from '@/lib/calendar/grid';
import { useMembers } from '@/lib/db/repositories/hooks';
import { occurrencesOnDay, type Occurrence } from '@/lib/recurrence/expand';
import { floatingDateToUtc, parseFloatingDate, todayIn, type FloatingDate } from '@/lib/time/zoned';
import { useDeviceStore } from '@/stores/deviceStore';
import { useUiStore } from '@/stores/uiStore';
import { DayAgenda } from './DayAgenda';
import { MonthView } from './MonthView';
import { TimeGrid } from './TimeGrid';
import { useOccurrences, useTaskProgress } from './useOccurrences';
import { WeekAgenda } from './WeekAgenda';

// Flag inlined at build time; webpack drops the dead import() when off (D-7.3).
const QuickAdd =
  process.env.NEXT_PUBLIC_FEATURE_INTAKE === 'true'
    ? dynamic(() => import('@/components/intake/QuickAdd'))
    : null;

function validDate(value: string | null): FloatingDate | undefined {
  if (!value) return undefined;
  try {
    parseFloatingDate(value);
    return value;
  } catch {
    return undefined;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export function CalendarView() {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const zone = useTimeZone() ?? 'UTC';
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const members = useMembers() ?? [];
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
  const openEditor = useUiStore((s) => s.openEditor);
  const wide = useMediaQuery('(min-width: 768px)');
  const now = useMinuteClock();

  const today = todayIn(zone, now);
  const view: View = isView(params.get('view')) ? (params.get('view') as View) : 'month';
  const anchor = validDate(params.get('date')) ?? today;
  const window = useMemo(() => windowFor(view, anchor, zone), [view, anchor, zone]);
  const occurrences = useOccurrences(window, zone, activeMemberId) ?? [];
  const progress = useTaskProgress();

  const navigate = (nextView: View, nextAnchor: FloatingDate) =>
    router.replace(`${pathname}?view=${nextView}&date=${nextAnchor}`, { scroll: false });
  const open = (occurrence: Occurrence) => openEditor({ mode: 'edit', occurrence });
  // Floating dates are formatted as UTC midnight in UTC, so no zone can shift the day.
  const label = (date: FloatingDate, options: DateTimeFormatOptions) =>
    format.dateTime(floatingDateToUtc(date), { ...options, timeZone: 'UTC' });
  const newEventDate =
    view === 'month' && wide && anchor.slice(0, 7) === today.slice(0, 7) ? today : anchor;
  const createAt = (date: FloatingDate, hour: number) => {
    // A tapped hour slot opens the editor preset to that hour.
    const start = `${pad(hour)}:00`;
    const end = `${pad(Math.min(hour + 1, 23))}:${hour + 1 > 23 ? '59' : '00'}`;
    openEditor({
      mode: 'new',
      date,
      draft: {
        title: '',
        description: '',
        location: '',
        isAllDay: false,
        date,
        endDate: date,
        startTime: start,
        endTime: end,
        timeZone: zone,
        memberIds: activeMemberId ? [activeMemberId] : [],
        visibility: 'family',
        repeat: 'none',
        createdById: activeMemberId ?? members.find((m) => m.role === 'parent')?.id ?? '',
      },
    });
  };

  const dates = visibleDates(view, anchor);
  const heading =
    view === 'month'
      ? label(anchor, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${label(dates[0] ?? anchor, { day: 'numeric', month: 'short' })} – ${label(dates[6] ?? anchor, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : label(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dayOccurrences = occurrencesOnDay(occurrences, anchor, zone);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1
          className="mr-auto min-w-0 text-2xl font-bold tracking-tight first-letter:uppercase sm:text-3xl"
          aria-live="polite"
        >
          {heading}
        </h1>
        <div className="flex items-center gap-1">
          <IconButton
            label={t('previous')}
            variant="secondary"
            onClick={() => navigate(view, shiftAnchor(anchor, view, -1))}
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </IconButton>
          <Button variant="secondary" onClick={() => navigate(view, today)}>
            {t('today')}
          </Button>
          <IconButton
            label={t('next')}
            variant="secondary"
            onClick={() => navigate(view, shiftAnchor(anchor, view, 1))}
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        <Segmented
          label={t('views.label')}
          value={view}
          options={VIEWS.map((v) => ({ value: v, label: t(`views.${v}`) }))}
          onChange={(v) => navigate(v, anchor)}
        />
        <Button onClick={() => openEditor({ mode: 'new', date: newEventDate })}>
          <Plus aria-hidden="true" className="size-5" />
          {t('newEvent')}
        </Button>
      </div>

      {QuickAdd && (
        <QuickAdd onEdit={(draft) => openEditor({ mode: 'new', date: draft.date, draft })} />
      )}

      {view === 'month' && (
        <>
          <MonthView
            anchor={anchor}
            today={today}
            zone={zone}
            occurrences={occurrences}
            members={members}
            progress={progress}
            compact={!wide}
            label={label}
            onOpen={open}
            onPickDay={(d) => (wide ? navigate('day', d) : navigate('month', d))}
          />
          {!wide && (
            <section aria-label={label(anchor, { weekday: 'long', day: 'numeric', month: 'long' })}>
              <h2 className="mb-2 font-bold first-letter:uppercase">
                {label(anchor, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <DayAgenda
                occurrences={dayOccurrences}
                members={members}
                progress={progress}
                onOpen={open}
              />
            </section>
          )}
        </>
      )}

      {view === 'week' &&
        (wide ? (
          <TimeGrid
            dates={dates}
            today={today}
            now={now}
            occurrences={occurrences}
            members={members}
            progress={progress}
            onOpen={open}
            onOpenDay={(d) => navigate('day', d)}
            onCreateAt={createAt}
          />
        ) : (
          <WeekAgenda
            dates={dates}
            today={today}
            zone={zone}
            occurrences={occurrences}
            members={members}
            progress={progress}
            label={label}
            onOpen={open}
          />
        ))}

      {view === 'day' && (
        <>
          {dayOccurrences.length === 0 && <p className="text-muted">{t('noEvents')}</p>}
          <TimeGrid
            dates={[anchor]}
            today={today}
            now={now}
            occurrences={occurrences}
            members={members}
            progress={progress}
            onOpen={open}
            onCreateAt={createAt}
          />
        </>
      )}
    </div>
  );
}
