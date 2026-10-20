import { describe, expect, it } from 'vitest';
import {
  addDays,
  instantToEpoch,
  instantToZoned,
  isoWeekday,
  isValidTimeZone,
  parseFloatingDate,
  zonedToInstant,
} from '@/lib/time/zoned';

describe('zoned time (D6)', () => {
  it('converts Amsterdam wall time to UTC on both sides of the 2026-10-25 DST change', () => {
    expect(zonedToInstant('2026-10-24', '19:00', 'Europe/Amsterdam')).toBe(
      '2026-10-24T17:00:00.000Z',
    ); // CEST +2
    expect(zonedToInstant('2026-10-25', '19:00', 'Europe/Amsterdam')).toBe(
      '2026-10-25T18:00:00.000Z',
    ); // CET +1
    expect(instantToZoned('2026-10-25T18:00:00.000Z', 'Europe/Amsterdam')).toEqual({
      date: '2026-10-25',
      time: '19:00',
    });
  });

  it('refuses instants without an explicit zone', () => {
    expect(() => instantToEpoch('2026-10-24T19:00:00')).toThrow(SyntaxError);
    expect(() => instantToEpoch('2026-10-24')).toThrow(SyntaxError);
    expect(instantToEpoch('2026-10-24T19:00:00+02:00')).toBe(Date.UTC(2026, 9, 24, 17));
  });

  it('does floating-date arithmetic without zone drift', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isoWeekday('2026-10-24')).toBe(5); // Saturday
    expect(() => parseFloatingDate('2026-02-30')).toThrow(RangeError);
  });

  it('validates IANA zones', () => {
    expect(isValidTimeZone('Europe/Amsterdam')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
