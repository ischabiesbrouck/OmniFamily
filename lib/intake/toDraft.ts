import type { EventDraft } from '@/lib/db/repositories/events';
import type { ParsedFamilyEntry } from '@/lib/db/schema';
import { addDays, instantToZoned } from '@/lib/time/zoned';

/** A parsed entry becomes an ordinary event draft; people review it before anything is saved. */
export function entryToDraft(entry: ParsedFamilyEntry, createdById: string): EventDraft {
  const start = instantToZoned(entry.startInstant, entry.timeZone);
  const end = instantToZoned(entry.endInstant, entry.timeZone);
  const endDate = entry.isAllDay && end.date > start.date ? addDays(end.date, -1) : start.date;
  return {
    title: entry.title,
    description: '',
    location: entry.location ?? '',
    isAllDay: entry.isAllDay,
    date: start.date,
    endDate: entry.isAllDay ? endDate : start.date,
    startTime: entry.isAllDay ? '09:00' : start.time,
    endTime: entry.isAllDay ? '10:00' : end.time > start.time ? end.time : start.time,
    timeZone: entry.timeZone,
    memberIds: [...entry.assigneeIds],
    visibility: 'family',
    repeat: 'none',
    createdById,
  };
}
