import { TZDate } from '@date-fns/tz';

/**
 * Time handling per SPEC D6: UTC ISO-8601 instants plus an IANA zone; all-day values are
 * floating `YYYY-MM-DD` dates. Strings are only ever parsed with an explicit zone.
 */

export type IsoInstant = string; // e.g. 2026-10-24T17:00:00.000Z
export type FloatingDate = string; // e.g. 2026-10-24
export type WallTime = string; // e.g. 19:00

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface WallClock {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Epoch ms of an instant string that carries its own zone (`Z` or `±hh:mm`). */
export function instantToEpoch(instant: IsoInstant): number {
  if (!INSTANT.test(instant)) throw new SyntaxError(`Not a zoned ISO instant: ${instant}`);
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) throw new SyntaxError(`Invalid instant: ${instant}`);
  return ms;
}

export function epochToInstant(ms: number): IsoInstant {
  return new Date(ms).toISOString();
}

export function parseFloatingDate(date: FloatingDate): {
  year: number;
  month: number;
  day: number;
} {
  const m = DATE.exec(date);
  if (!m) throw new SyntaxError(`Not a YYYY-MM-DD date: ${date}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`No such date: ${date}`);
  }
  return { year, month, day };
}

export function parseWallTime(time: WallTime): { hour: number; minute: number } {
  const m = TIME.exec(time);
  if (!m) throw new SyntaxError(`Not an HH:mm time: ${time}`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Real instant of a wall-clock time in a zone. Times in a spring-forward gap move forward. */
export function wallClockToEpoch(wall: WallClock, zone: string): number {
  return new TZDate(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, zone).getTime();
}

export function zonedToInstant(date: FloatingDate, time: WallTime, zone: string): IsoInstant {
  return epochToInstant(
    wallClockToEpoch({ ...parseFloatingDate(date), ...parseWallTime(time) }, zone),
  );
}

export function epochToWallClock(ms: number, zone: string): WallClock {
  const d = new TZDate(ms, zone);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function formatFloatingDate({
  year,
  month,
  day,
}: Pick<WallClock, 'year' | 'month' | 'day'>): FloatingDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function formatWallTime({ hour, minute }: Pick<WallClock, 'hour' | 'minute'>): WallTime {
  return `${pad(hour)}:${pad(minute)}`;
}

/** Date and time an instant shows on a wall clock in `zone`. */
export function instantToZoned(
  instant: IsoInstant,
  zone: string,
): { date: FloatingDate; time: WallTime } {
  const wall = epochToWallClock(instantToEpoch(instant), zone);
  return { date: formatFloatingDate(wall), time: formatWallTime(wall) };
}

/** Floating-date arithmetic in UTC space, so no zone or DST can shift the day. */
export function addDays(date: FloatingDate, days: number): FloatingDate {
  const { year, month, day } = parseFloatingDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatFloatingDate({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

export function compareDates(a: FloatingDate, b: FloatingDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Monday … 6 = Sunday (ISO weekday order, used for Europe-first calendar grids). */
export function isoWeekday(date: FloatingDate): number {
  const { year, month, day } = parseFloatingDate(date);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** Epoch ms of local midnight that starts `date` in `zone`. */
export function startOfDayEpoch(date: FloatingDate, zone: string): number {
  return wallClockToEpoch({ ...parseFloatingDate(date), hour: 0, minute: 0 }, zone);
}

export function todayIn(zone: string, now: number = Date.now()): FloatingDate {
  return formatFloatingDate(epochToWallClock(now, zone));
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function diffDays(a: FloatingDate, b: FloatingDate): number {
  const pa = parseFloatingDate(a);
  const pb = parseFloatingDate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) /
      86_400_000,
  );
}

/** A floating date as a UTC midnight `Date`, for formatting with `timeZone: 'UTC'` only. */
export function floatingDateToUtc(date: FloatingDate): Date {
  const { year, month, day } = parseFloatingDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

export function supportedTimeZones(current: string): string[] {
  const zones =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return zones.includes(current) ? zones : [current, ...zones];
}
