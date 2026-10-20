import type { Occurrence, Window } from '@/lib/recurrence/expand';
import {
  addDays,
  isoWeekday,
  parseFloatingDate,
  startOfDayEpoch,
  type FloatingDate,
} from '@/lib/time/zoned';

export const VIEWS = ['month', 'week', 'day'] as const;
export type CalendarView = (typeof VIEWS)[number];

export function isView(value: unknown): value is CalendarView {
  return typeof value === 'string' && (VIEWS as readonly string[]).includes(value);
}

/** Monday on or before `date`. */
export function startOfWeek(date: FloatingDate): FloatingDate {
  return addDays(date, -isoWeekday(date));
}

export function startOfMonth(date: FloatingDate): FloatingDate {
  return `${date.slice(0, 7)}-01`;
}

/** 6 × 7 Monday-first grid covering the month of `anchor`. */
export function monthGrid(anchor: FloatingDate): FloatingDate[] {
  const first = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekDates(anchor: FloatingDate): FloatingDate[] {
  const first = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function shiftAnchor(
  anchor: FloatingDate,
  view: CalendarView,
  direction: 1 | -1,
): FloatingDate {
  if (view === 'day') return addDays(anchor, direction);
  if (view === 'week') return addDays(anchor, 7 * direction);
  const { year, month } = parseFloatingDate(anchor);
  const d = new Date(Date.UTC(year, month - 1 + direction, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function visibleDates(view: CalendarView, anchor: FloatingDate): FloatingDate[] {
  if (view === 'month') return monthGrid(anchor);
  if (view === 'week') return weekDates(anchor);
  return [anchor];
}

/** Epoch window covering the visible days in the viewer's zone. */
export function windowFor(view: CalendarView, anchor: FloatingDate, zone: string): Window {
  const dates = visibleDates(view, anchor);
  const first = dates[0] ?? anchor;
  const last = dates[dates.length - 1] ?? anchor;
  return { start: startOfDayEpoch(first, zone), end: startOfDayEpoch(addDays(last, 1), zone) };
}

/**
 * Private events show only to the people involved and their creator (D-3.6). Without an
 * active profile on this device, only family-visible events show.
 */
export function isVisibleTo(occurrence: Occurrence, activeMemberId: string | null): boolean {
  const { event } = occurrence;
  if (event.visibility === 'family') return true;
  if (activeMemberId === null) return false;
  return event.createdById === activeMemberId || event.memberIds.includes(activeMemberId);
}
