import { RRule } from 'rrule';
import type { FamilyEvent } from '@/lib/db/schema';
import {
  addDays,
  compareDates,
  diffDays,
  epochToWallClock,
  formatFloatingDate,
  instantToEpoch,
  parseFloatingDate,
  startOfDayEpoch,
  wallClockToEpoch,
  type FloatingDate,
  type IsoInstant,
} from '@/lib/time/zoned';

/** SPEC D7: expansion is lazy, per visible window, and never spans more than 24 months. */
export const MAX_WINDOW_MONTHS = 24;
export const MAX_OCCURRENCES_PER_EVENT = 1_000;
const DAY_MS = 86_400_000;

export const REPEAT_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];

export interface Window {
  /** inclusive, epoch ms */
  start: number;
  /** exclusive, epoch ms */
  end: number;
}

export interface Occurrence {
  /** Stable React key: event id + original occurrence. */
  key: string;
  event: FamilyEvent;
  /** Master event id for recurring series (the event itself otherwise). */
  seriesId: string;
  /** Original occurrence start, used as exDate / override `recurrenceId`. */
  recurrenceId?: IsoInstant;
  start: number;
  end: number;
  isAllDay: boolean;
  /** For all-day occurrences: floating first and last (inclusive) day. */
  startDate?: FloatingDate;
  endDate?: FloatingDate;
}

export function buildRRule(frequency: RepeatFrequency, interval = 1): string {
  return interval > 1 ? `FREQ=${frequency};INTERVAL=${interval}` : `FREQ=${frequency}`;
}

export function frequencyOf(rrule: string | undefined): RepeatFrequency | undefined {
  const match = /FREQ=([A-Z]+)/.exec(rrule ?? '');
  const freq = match?.[1];
  return REPEAT_FREQUENCIES.find((f) => f === freq);
}

export function clampWindow(window: Window): Window {
  const limit = new Date(window.start);
  limit.setUTCMonth(limit.getUTCMonth() + MAX_WINDOW_MONTHS);
  return { start: window.start, end: Math.min(window.end, limit.getTime()) };
}

/** UTC-encoded wall clock: rrule computes in "floating" time so DST cannot shift the hour. */
function toFloatingUtc(ms: number, zone: string): Date {
  const w = epochToWallClock(ms, zone);
  return new Date(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute));
}

function fromFloatingUtc(floating: Date, zone: string): number {
  return wallClockToEpoch(
    {
      year: floating.getUTCFullYear(),
      month: floating.getUTCMonth() + 1,
      day: floating.getUTCDate(),
      hour: floating.getUTCHours(),
      minute: floating.getUTCMinutes(),
    },
    zone,
  );
}

function allDaySpan(event: FamilyEvent): { start: FloatingDate; end: FloatingDate } {
  const start = event.allDayStartDate ?? event.startInstant.slice(0, 10);
  const end = event.allDayEndDate ?? start;
  return { start, end: compareDates(end, start) < 0 ? start : end };
}

function single(event: FamilyEvent, viewZone: string, recurrenceId?: IsoInstant): Occurrence {
  const base = {
    event,
    seriesId: event.recurrenceParentId ?? event.id,
    ...(recurrenceId ? { recurrenceId } : {}),
  };
  if (event.isAllDay) {
    const span = allDaySpan(event);
    return {
      ...base,
      key: `${event.id}:${span.start}`,
      isAllDay: true,
      startDate: span.start,
      endDate: span.end,
      start: startOfDayEpoch(span.start, viewZone),
      end: startOfDayEpoch(addDays(span.end, 1), viewZone),
    };
  }
  const start = instantToEpoch(event.startInstant);
  return {
    ...base,
    key: `${event.id}:${event.startInstant}`,
    isAllDay: false,
    start,
    end: Math.max(start, instantToEpoch(event.endInstant)),
  };
}

function expandSeries(
  master: FamilyEvent,
  rrule: string,
  window: Window,
  viewZone: string,
): Occurrence[] {
  const excluded = new Set(master.exDates ?? []);
  const options = RRule.parseString(rrule);
  const occurrences: Occurrence[] = [];

  if (master.isAllDay) {
    const span = allDaySpan(master);
    const lengthDays = diffDays(span.start, span.end);
    const { year, month, day } = parseFloatingDate(span.start);
    const rule = new RRule({ ...options, dtstart: new Date(Date.UTC(year, month - 1, day)) });
    // Floating dates: widen by the span length plus a day either side for zone offsets.
    const from = new Date(window.start - (lengthDays + 1) * DAY_MS);
    const to = new Date(window.end + DAY_MS);
    for (const d of rule.between(from, to, true).slice(0, MAX_OCCURRENCES_PER_EVENT)) {
      const startDate = formatFloatingDate({
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
      });
      const recurrenceId = `${startDate}T00:00:00.000Z`;
      if (excluded.has(recurrenceId)) continue;
      const endDate = addDays(startDate, lengthDays);
      occurrences.push({
        key: `${master.id}:${recurrenceId}`,
        event: master,
        seriesId: master.id,
        recurrenceId,
        isAllDay: true,
        startDate,
        endDate,
        start: startOfDayEpoch(startDate, viewZone),
        end: startOfDayEpoch(addDays(endDate, 1), viewZone),
      });
    }
    return occurrences;
  }

  const zone = master.timeZone;
  const firstStart = instantToEpoch(master.startInstant);
  const duration = Math.max(0, instantToEpoch(master.endInstant) - firstStart);
  const rule = new RRule({ ...options, dtstart: toFloatingUtc(firstStart, zone) });
  // Search in floating time with a day of slack for the zone offset and the event's length.
  const from = toFloatingUtc(window.start - duration - DAY_MS, 'UTC');
  const to = toFloatingUtc(window.end + DAY_MS, 'UTC');
  for (const floating of rule.between(from, to, true).slice(0, MAX_OCCURRENCES_PER_EVENT)) {
    const start = fromFloatingUtc(floating, zone);
    const recurrenceId = new Date(start).toISOString();
    if (excluded.has(recurrenceId)) continue;
    occurrences.push({
      key: `${master.id}:${recurrenceId}`,
      event: master,
      seriesId: master.id,
      recurrenceId,
      isAllDay: false,
      start,
      end: start + duration,
    });
  }
  return occurrences;
}

/**
 * All occurrences overlapping `window`, sorted by start. Recurring masters are expanded in
 * their own zone's wall-clock time; overrides (`recurrenceParentId` + `recurrenceId`)
 * replace the occurrence they modify. `viewZone` only places all-day days on the timeline.
 */
export function occurrencesInWindow(
  events: readonly FamilyEvent[],
  requested: Window,
  viewZone: string,
): Occurrence[] {
  const window = clampWindow(requested);
  const live = events.filter((e) => e.deletedAt === undefined);
  const overridden = new Set(
    live
      .filter((e) => e.recurrenceParentId && e.recurrenceId)
      .map((e) => `${e.recurrenceParentId}:${e.recurrenceId}`),
  );

  const all: Occurrence[] = [];
  for (const event of live) {
    if (event.rrule && !event.recurrenceParentId) {
      for (const occ of expandSeries(event, event.rrule, window, viewZone)) {
        if (!overridden.has(`${event.id}:${occ.recurrenceId}`)) all.push(occ);
      }
    } else {
      all.push(single(event, viewZone, event.recurrenceId));
    }
  }

  return all
    .filter(
      (o) =>
        o.start < window.end &&
        (o.end > window.start || (o.end === o.start && o.start >= window.start)),
    )
    .sort(
      (a, b) =>
        a.start - b.start ||
        Number(b.isAllDay) - Number(a.isAllDay) ||
        a.event.title.localeCompare(b.event.title),
    );
}

/** Occurrences touching one floating day in `zone`. */
export function occurrencesOnDay(
  occurrences: readonly Occurrence[],
  date: FloatingDate,
  zone: string,
): Occurrence[] {
  const start = startOfDayEpoch(date, zone);
  const end = startOfDayEpoch(addDays(date, 1), zone);
  return occurrences.filter(
    (o) => o.start < end && (o.end > start || (o.end === o.start && o.start >= start)),
  );
}
