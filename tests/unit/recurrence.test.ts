import { describe, expect, it } from 'vitest';
import type { FamilyEvent } from '@/lib/db/schema';
import {
  buildRRule,
  MAX_WINDOW_MONTHS,
  occurrencesInWindow,
  occurrencesOnDay,
} from '@/lib/recurrence/expand';
import { instantToZoned, zonedToInstant } from '@/lib/time/zoned';

const AMS = 'Europe/Amsterdam';

function event(overrides: Partial<FamilyEvent>): FamilyEvent {
  return {
    id: 'e1',
    hlc: '000000000000:0000:dev',
    updatedAt: 0,
    syncStatus: 'pending_insert',
    title: 'Swimming',
    startInstant: zonedToInstant('2026-10-24', '19:00', AMS),
    endInstant: zonedToInstant('2026-10-24', '20:00', AMS),
    timeZone: AMS,
    isAllDay: false,
    memberIds: [],
    visibility: 'family',
    createdById: 'm1',
    ...overrides,
  };
}

const window = (from: string, to: string) => ({
  start: Date.parse(`${from}T00:00:00Z`),
  end: Date.parse(`${to}T00:00:00Z`),
});
const wall = (ms: number, zone = AMS) => instantToZoned(new Date(ms).toISOString(), zone);

describe('acceptance: DST-correct rendering (Phase 3)', () => {
  it('an event created 2026-10-24 19:00 Europe/Amsterdam still renders 19:00 after the DST shift', () => {
    const weekly = event({ rrule: buildRRule('WEEKLY') });
    const occ = occurrencesInWindow([weekly], window('2026-10-20', '2026-11-10'), AMS);

    expect(occ.map((o) => wall(o.start))).toEqual([
      { date: '2026-10-24', time: '19:00' }, // CEST, UTC+2
      { date: '2026-10-31', time: '19:00' }, // CET, UTC+1 — after the 25 Oct shift
      { date: '2026-11-07', time: '19:00' },
    ]);
    // The UTC instant moves by an hour so the wall-clock time does not.
    expect(new Date(occ[0]!.start).toISOString()).toBe('2026-10-24T17:00:00.000Z');
    expect(new Date(occ[1]!.start).toISOString()).toBe('2026-10-31T18:00:00.000Z');
    expect(occ.every((o) => o.end - o.start === 3_600_000)).toBe(true);
  });

  it('a one-off event keeps its instant: viewed from New York it is 13:00, from Amsterdam 19:00', () => {
    const [occ] = occurrencesInWindow([event({})], window('2026-10-24', '2026-10-25'), AMS);
    expect(wall(occ!.start, AMS).time).toBe('19:00');
    expect(wall(occ!.start, 'America/New_York').time).toBe('13:00');
  });

  it('daily series across the spring-forward change keep their wall time', () => {
    const daily = event({
      startInstant: zonedToInstant('2026-03-27', '08:00', AMS),
      endInstant: zonedToInstant('2026-03-27', '08:30', AMS),
      rrule: buildRRule('DAILY'),
    });
    const occ = occurrencesInWindow([daily], window('2026-03-27', '2026-03-31'), AMS);
    expect(occ.map((o) => wall(o.start).time)).toEqual(['08:00', '08:00', '08:00', '08:00']);
  });
});

describe('recurrence expansion (D7)', () => {
  it('honours exDates and replaces overridden occurrences', () => {
    const master = event({ rrule: buildRRule('WEEKLY'), exDates: ['2026-10-31T18:00:00.000Z'] });
    const override = event({
      id: 'e1-override',
      title: 'Swimming (late)',
      recurrenceParentId: 'e1',
      recurrenceId: '2026-11-07T18:00:00.000Z',
      startInstant: zonedToInstant('2026-11-07', '20:00', AMS),
      endInstant: zonedToInstant('2026-11-07', '21:00', AMS),
    });
    const occ = occurrencesInWindow([master, override], window('2026-10-20', '2026-11-15'), AMS);
    expect(occ.map((o) => [wall(o.start).date, wall(o.start).time, o.event.title])).toEqual([
      ['2026-10-24', '19:00', 'Swimming'],
      ['2026-11-07', '20:00', 'Swimming (late)'],
      ['2026-11-14', '19:00', 'Swimming'],
    ]);
    expect(occ[1]?.seriesId).toBe('e1');
  });

  it('ignores tombstoned events and overrides', () => {
    const master = event({ rrule: buildRRule('DAILY') });
    const deletedOverride = event({
      id: 'x',
      recurrenceParentId: 'e1',
      recurrenceId: '2026-10-25T18:00:00.000Z',
      deletedAt: 1,
    });
    expect(
      occurrencesInWindow([master, deletedOverride], window('2026-10-25', '2026-10-26'), AMS),
    ).toHaveLength(1);
    expect(
      occurrencesInWindow([{ ...master, deletedAt: 1 }], window('2026-10-25', '2026-10-26'), AMS),
    ).toHaveLength(0);
  });

  it('caps every expansion window at 24 months', () => {
    const daily = event({ rrule: buildRRule('DAILY') });
    const occ = occurrencesInWindow([daily], window('2026-10-24', '2036-10-24'), AMS);
    const last = new Date(occ.at(-1)!.start);
    expect(MAX_WINDOW_MONTHS).toBe(24);
    expect(last.getTime()).toBeLessThan(Date.parse('2028-10-25T00:00:00Z'));
    expect(occ.length).toBeGreaterThan(700);
  });

  it('expands all-day series on floating dates, independent of the viewer zone', () => {
    const birthday = event({
      isAllDay: true,
      allDayStartDate: '2026-10-25',
      allDayEndDate: '2026-10-25',
      startInstant: '2026-10-25T00:00:00.000Z',
      endInstant: '2026-10-25T00:00:00.000Z',
      rrule: buildRRule('YEARLY'),
    });
    for (const zone of [AMS, 'Pacific/Auckland', 'America/Los_Angeles']) {
      const occ = occurrencesInWindow([birthday], window('2026-01-01', '2028-01-01'), zone);
      expect(occ.map((o) => o.startDate)).toEqual(['2026-10-25', '2027-10-25']);
      expect(occurrencesOnDay(occ, '2026-10-25', zone)).toHaveLength(1);
      expect(occurrencesOnDay(occ, '2026-10-24', zone)).toHaveLength(0);
      expect(occurrencesOnDay(occ, '2026-10-26', zone)).toHaveLength(0);
    }
  });

  it('multi-day all-day events cover each day of their span', () => {
    const trip = event({
      isAllDay: true,
      allDayStartDate: '2026-10-24',
      allDayEndDate: '2026-10-26',
    });
    const occ = occurrencesInWindow([trip], window('2026-10-20', '2026-11-01'), AMS);
    expect(
      ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'].map(
        (d) => occurrencesOnDay(occ, d, AMS).length,
      ),
    ).toEqual([0, 1, 1, 1, 0]);
  });
});
