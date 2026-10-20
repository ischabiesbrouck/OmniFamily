import { describe, expect, it } from 'vitest';
import { createEvent, type EventDraft } from '@/lib/db/repositories/events';
import { setSetting } from '@/lib/db/repositories/settings';
import {
  claimDueReminders,
  dueReminders,
  REMINDERS_ENABLED_KEY,
} from '@/lib/notifications/reminders';
import { setupRepositories } from './helpers';

const draft: EventDraft = {
  title: 'Swimming',
  description: '',
  location: 'Pool',
  isAllDay: false,
  date: '2026-10-24',
  endDate: '2026-10-24',
  startTime: '19:00',
  endTime: '20:00',
  timeZone: 'Europe/Amsterdam',
  memberIds: [],
  visibility: 'family',
  repeat: 'WEEKLY',
  createdById: 'm',
};
const at = (iso: string) => Date.parse(iso);

describe('local reminders (D8)', () => {
  it('fires within the 15-minute lead, once per occurrence, including after DST', async () => {
    const { db, repos } = setupRepositories();
    await createEvent(repos.core, draft);
    await setSetting(db, REMINDERS_ENABLED_KEY, true);

    expect(await claimDueReminders(db, at('2026-10-24T16:44:00Z'))).toEqual([]); // 16 min before
    const first = await claimDueReminders(db, at('2026-10-24T16:46:00Z'));
    expect(first.map((r) => [r.title, new Date(r.start).toISOString()])).toEqual([
      ['Swimming', '2026-10-24T17:00:00.000Z'],
    ]);
    expect(await claimDueReminders(db, at('2026-10-24T16:50:00Z'))).toEqual([]); // already claimed
    // next week, after the clocks went back, 19:00 local is 18:00Z
    expect((await claimDueReminders(db, at('2026-10-31T17:50:00Z'))).map((r) => r.start)).toEqual([
      at('2026-10-31T18:00:00Z'),
    ]);
  });

  it('does nothing while reminders are off', async () => {
    const { db, repos } = setupRepositories();
    await createEvent(repos.core, draft);
    expect(await claimDueReminders(db, at('2026-10-24T16:50:00Z'))).toEqual([]);
  });

  it('skips all-day and private events', async () => {
    const { repos } = setupRepositories();
    const priv = await createEvent(repos.core, { ...draft, visibility: 'private', repeat: 'none' });
    const allDay = await createEvent(repos.core, { ...draft, isAllDay: true, repeat: 'none' });
    expect(dueReminders([priv, allDay], at('2026-10-24T16:50:00Z'), new Set())).toEqual([]);
  });
});
