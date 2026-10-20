import { describe, expect, it } from 'vitest';
import { isVisibleTo, monthGrid, shiftAnchor, weekDates, windowFor } from '@/lib/calendar/grid';
import type { Occurrence } from '@/lib/recurrence/expand';

describe('calendar grid', () => {
  it('builds a Monday-first 6-week month grid', () => {
    const grid = monthGrid('2026-10-24');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-09-28'); // Monday before 1 Oct (a Thursday)
    expect(grid).toContain('2026-10-31');
    expect(grid[41]).toBe('2026-11-08');
  });

  it('builds a week and shifts anchors', () => {
    expect(weekDates('2026-10-25')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(shiftAnchor('2026-10-24', 'day', 1)).toBe('2026-10-25');
    expect(shiftAnchor('2026-10-24', 'week', -1)).toBe('2026-10-17');
    expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01');
    expect(shiftAnchor('2026-01-15', 'month', -1)).toBe('2025-12-01');
  });

  it('a day window across the DST change is 25 hours long in Amsterdam', () => {
    const w = windowFor('day', '2026-10-25', 'Europe/Amsterdam');
    expect(w.end - w.start).toBe(25 * 3_600_000);
  });

  it('hides private events from uninvolved profiles', () => {
    const occ = (visibility: 'family' | 'private') =>
      ({ event: { visibility, createdById: 'a', memberIds: ['b'] } }) as unknown as Occurrence;
    expect(isVisibleTo(occ('family'), null)).toBe(true);
    expect(isVisibleTo(occ('private'), null)).toBe(false);
    expect(isVisibleTo(occ('private'), 'a')).toBe(true);
    expect(isVisibleTo(occ('private'), 'b')).toBe(true);
    expect(isVisibleTo(occ('private'), 'c')).toBe(false);
  });
});
