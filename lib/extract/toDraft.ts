import type { EventDraft } from '@/lib/db/repositories/events';
import type { Candidate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** One hour after `start`, capped at 23:59 so the event stays on its day. */
export function plusOneHour(start: string): string {
  const [h = 0, m = 0] = start.split(':').map(Number);
  return h >= 23 ? '23:59' : `${pad(h + 1)}:${pad(m)}`;
}

export function candidateToDraft(c: Candidate, timeZone: string, createdById: string): EventDraft {
  return {
    title: c.title,
    description: '',
    location: c.location ?? '',
    isAllDay: !c.startTime,
    date: c.date,
    endDate: c.endDate ?? c.date,
    startTime: c.startTime ?? '09:00',
    endTime: c.startTime ? (c.endTime ?? plusOneHour(c.startTime)) : '10:00',
    timeZone,
    memberIds: [...c.memberIds],
    visibility: 'family',
    repeat: 'none',
    createdById,
  };
}
