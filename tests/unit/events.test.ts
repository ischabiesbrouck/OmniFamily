import { describe, expect, it } from 'vitest';
import {
  createEvent,
  deleteEvent,
  draftFromOccurrence,
  updateEvent,
  validateDraft,
  type EventDraft,
} from '@/lib/db/repositories/events';
import { occurrencesInWindow } from '@/lib/recurrence/expand';
import { instantToZoned } from '@/lib/time/zoned';
import { setupRepositories } from './helpers';

const AMS = 'Europe/Amsterdam';
const draft: EventDraft = {
  title: 'Swimming',
  description: '',
  location: 'Pool',
  isAllDay: false,
  date: '2026-10-24',
  endDate: '2026-10-24',
  startTime: '19:00',
  endTime: '20:00',
  timeZone: AMS,
  memberIds: ['m1'],
  visibility: 'family',
  repeat: 'WEEKLY',
  createdById: 'm1',
};
const window = {
  start: Date.parse('2026-10-20T00:00:00Z'),
  end: Date.parse('2026-11-15T00:00:00Z'),
};

async function series() {
  const ctx = setupRepositories();
  const master = await createEvent(ctx.repos.core, draft);
  const occurrences = async () => occurrencesInWindow(await ctx.repos.events.list(), window, AMS);
  return { ...ctx, master, occurrences };
}
const label = (o: { start: number; event: { title: string } }) =>
  `${instantToZoned(new Date(o.start).toISOString(), AMS).date} ${instantToZoned(new Date(o.start).toISOString(), AMS).time} ${o.event.title}`;

describe('event drafts', () => {
  it('validates', () => {
    expect(validateDraft(draft)).toBeUndefined();
    expect(validateDraft({ ...draft, title: ' ' })).toBe('titleRequired');
    expect(validateDraft({ ...draft, endTime: '18:00' })).toBe('endBeforeStart');
    expect(validateDraft({ ...draft, timeZone: 'Nowhere/Land' })).toBe('invalidTimeZone');
    expect(validateDraft({ ...draft, date: '2026-13-01' })).toBe('invalidDate');
    expect(validateDraft({ ...draft, isAllDay: true, endDate: '2026-10-23' })).toBe(
      'endBeforeStart',
    );
  });

  it('stores a UTC instant plus the IANA zone, and an all-day event as floating dates', async () => {
    const { repos } = setupRepositories();
    const timed = await createEvent(repos.core, { ...draft, repeat: 'none' });
    expect(timed).toMatchObject({
      startInstant: '2026-10-24T17:00:00.000Z',
      endInstant: '2026-10-24T18:00:00.000Z',
      timeZone: AMS,
    });
    expect(timed.rrule).toBeUndefined();

    const allDay = await createEvent(repos.core, {
      ...draft,
      isAllDay: true,
      endDate: '2026-10-26',
      repeat: 'none',
    });
    expect(allDay).toMatchObject({
      isAllDay: true,
      allDayStartDate: '2026-10-24',
      allDayEndDate: '2026-10-26',
    });
  });
});

describe('editing and deleting recurring events', () => {
  it('"this occurrence" creates an override; the rest of the series is untouched', async () => {
    const { repos, occurrences } = await series();
    const second = (await occurrences())[1]!;
    const edit = {
      ...draftFromOccurrence(second),
      startTime: '20:00',
      endTime: '21:00',
      title: 'Swimming (late)',
    };
    const override = await updateEvent(repos.core, second, edit, 'this');

    expect(override).toMatchObject({
      recurrenceParentId: second.seriesId,
      recurrenceId: '2026-10-31T18:00:00.000Z',
    });
    expect((await occurrences()).map(label)).toEqual([
      '2026-10-24 19:00 Swimming',
      '2026-10-31 20:00 Swimming (late)',
      '2026-11-07 19:00 Swimming',
      '2026-11-14 19:00 Swimming',
    ]);
  });

  it('"all occurrences" from a later occurrence keeps the series start date', async () => {
    const { repos, occurrences } = await series();
    const third = (await occurrences())[2]!;
    await updateEvent(
      repos.core,
      third,
      { ...draftFromOccurrence(third), startTime: '18:30', endTime: '19:30' },
      'all',
    );
    expect((await occurrences()).map(label)).toEqual([
      '2026-10-24 18:30 Swimming',
      '2026-10-31 18:30 Swimming',
      '2026-11-07 18:30 Swimming',
      '2026-11-14 18:30 Swimming',
    ]);
  });

  it('deleting one occurrence adds an exDate; an overridden one is tombstoned too', async () => {
    const { repos, occurrences, master } = await series();
    const [first, second] = await occurrences();
    await updateEvent(
      repos.core,
      second!,
      { ...draftFromOccurrence(second!), title: 'Moved' },
      'this',
    );
    const moved = (await occurrences())[1]!;

    await deleteEvent(repos.core, first!, 'this');
    await deleteEvent(repos.core, moved, 'this');

    expect((await occurrences()).map(label)).toEqual([
      '2026-11-07 19:00 Swimming',
      '2026-11-14 19:00 Swimming',
    ]);
    expect((await repos.events.get(master.id))?.exDates).toEqual([
      '2026-10-24T17:00:00.000Z',
      '2026-10-31T18:00:00.000Z',
    ]);
  });

  it('deleting the series tombstones the master and every override', async () => {
    const { db, repos, occurrences } = await series();
    const second = (await occurrences())[1]!;
    await updateEvent(
      repos.core,
      second,
      { ...draftFromOccurrence(second), title: 'Moved' },
      'this',
    );
    await deleteEvent(repos.core, (await occurrences())[0]!, 'all');

    expect(await occurrences()).toEqual([]);
    const raw = await db.events.toArray();
    expect(raw).toHaveLength(2);
    expect(raw.every((e) => e.deletedAt !== undefined && e.syncStatus === 'pending_delete')).toBe(
      true,
    );
  });

  it('turning a plain event into a series and back', async () => {
    const { repos } = setupRepositories();
    const plain = await createEvent(repos.core, { ...draft, repeat: 'none' });
    const [occ] = occurrencesInWindow([plain], window, AMS);
    const weekly = await updateEvent(
      repos.core,
      occ!,
      { ...draftFromOccurrence(occ!), repeat: 'WEEKLY' },
      'all',
    );
    expect(weekly.rrule).toBe('FREQ=WEEKLY');
    const [again] = occurrencesInWindow([weekly], window, AMS);
    const once = await updateEvent(
      repos.core,
      again!,
      { ...draftFromOccurrence(again!), repeat: 'none' },
      'all',
    );
    expect(once.rrule).toBeUndefined();
  });
});
