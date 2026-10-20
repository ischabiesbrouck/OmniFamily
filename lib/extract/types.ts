import type { FloatingDate, WallTime } from '@/lib/time/zoned';

/** One event found in pasted text, a photo or a spreadsheet row, awaiting review. */
export interface Candidate {
  key: string;
  title: string;
  date: FloatingDate;
  /** Absent for all-day entries. */
  startTime?: WallTime;
  endTime?: WallTime;
  /** Last day (inclusive) of a multi-day all-day entry. */
  endDate?: FloatingDate;
  location?: string;
  memberIds: string[];
  /** The text it came from, shown during review. */
  source: string;
}

export interface ExtractOptions {
  /** UI locale tag, e.g. "nl-NL" or "en-US"; decides day/month order for "3/11". */
  locale: string;
  /** "Now", as a UTC instant; relative words ("tomorrow", "Saturday") count from here. */
  now: Date;
  timeZone: string;
  members: ReadonlyArray<{ id: string; name: string }>;
  /** Title for a line that is only a date. */
  fallbackTitle: string;
}
