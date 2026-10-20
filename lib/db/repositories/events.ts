import {
  buildRRule,
  frequencyOf,
  type Occurrence,
  type RepeatFrequency,
} from '@/lib/recurrence/expand';
import {
  addDays,
  compareDates,
  diffDays,
  instantToZoned,
  isValidTimeZone,
  parseFloatingDate,
  parseWallTime,
  zonedToInstant,
  type FloatingDate,
  type WallTime,
} from '@/lib/time/zoned';
import type { FamilyEvent } from '../schema';
import type { NewRecord, RecordPatch, RepositoryCore, Writer } from './core';

/** What the event form edits. Converted to a stored record per D6/D7. */
export interface EventDraft {
  title: string;
  description: string;
  location: string;
  isAllDay: boolean;
  /** First day (timed events: the day they start). */
  date: FloatingDate;
  /** Last day, inclusive (all-day only). */
  endDate: FloatingDate;
  startTime: WallTime;
  endTime: WallTime;
  timeZone: string;
  memberIds: string[];
  visibility: FamilyEvent['visibility'];
  repeat: RepeatFrequency | 'none';
  createdById: string;
}

export type DraftError =
  'titleRequired' | 'invalidDate' | 'invalidTime' | 'endBeforeStart' | 'invalidTimeZone';

export function validateDraft(draft: EventDraft): DraftError | undefined {
  if (draft.title.trim() === '') return 'titleRequired';
  try {
    parseFloatingDate(draft.date);
    if (draft.isAllDay) parseFloatingDate(draft.endDate);
  } catch {
    return 'invalidDate';
  }
  if (draft.isAllDay)
    return compareDates(draft.endDate, draft.date) < 0 ? 'endBeforeStart' : undefined;
  if (!isValidTimeZone(draft.timeZone)) return 'invalidTimeZone';
  try {
    parseWallTime(draft.startTime);
    parseWallTime(draft.endTime);
  } catch {
    return 'invalidTime';
  }
  return draft.endTime <= draft.startTime ? 'endBeforeStart' : undefined;
}

type EventFields = Omit<NewRecord<FamilyEvent>, 'createdById'>;

function draftFields(draft: EventDraft): EventFields {
  const common = {
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    location: draft.location.trim() || undefined,
    memberIds: [...draft.memberIds],
    visibility: draft.visibility,
    timeZone: draft.timeZone,
  };
  if (draft.isAllDay) {
    // Instants of an all-day event are sort keys only; the floating dates are authoritative.
    return {
      ...common,
      isAllDay: true,
      allDayStartDate: draft.date,
      allDayEndDate: draft.endDate,
      startInstant: `${draft.date}T00:00:00.000Z`,
      endInstant: `${addDays(draft.endDate, 1)}T00:00:00.000Z`,
    };
  }
  return {
    ...common,
    isAllDay: false,
    allDayStartDate: undefined,
    allDayEndDate: undefined,
    startInstant: zonedToInstant(draft.date, draft.startTime, draft.timeZone),
    endInstant: zonedToInstant(draft.date, draft.endTime, draft.timeZone),
  };
}

/** Draft for editing an occurrence (or a plain event), in the event's own zone. */
export function draftFromOccurrence(occurrence: Occurrence): EventDraft {
  const { event } = occurrence;
  const start = new Date(occurrence.start).toISOString();
  const end = new Date(occurrence.end).toISOString();
  const startZoned = instantToZoned(start, event.timeZone);
  return {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    isAllDay: event.isAllDay,
    date: occurrence.startDate ?? startZoned.date,
    endDate: occurrence.endDate ?? startZoned.date,
    startTime: event.isAllDay ? '09:00' : startZoned.time,
    endTime: event.isAllDay ? '10:00' : instantToZoned(end, event.timeZone).time,
    timeZone: event.timeZone,
    memberIds: [...event.memberIds],
    visibility: event.visibility,
    repeat: frequencyOf(event.rrule) ?? 'none',
    createdById: event.createdById,
  };
}

export function createEvent(core: RepositoryCore, draft: EventDraft): Promise<FamilyEvent> {
  return core.write(['event'], (w) =>
    w.insert('event', {
      ...draftFields(draft),
      createdById: draft.createdById,
      ...(draft.repeat === 'none' ? {} : { rrule: buildRRule(draft.repeat), exDates: [] }),
    }),
  );
}

export type EditScope = 'this' | 'all';

export function isRecurring(occurrence: Occurrence): boolean {
  return occurrence.recurrenceId !== undefined;
}

/** Edits a plain event, a whole series (`all`) or a single occurrence (`this`, via an override). */
export function updateEvent(
  core: RepositoryCore,
  occurrence: Occurrence,
  draft: EventDraft,
  scope: EditScope,
): Promise<FamilyEvent> {
  const fields = draftFields(draft);
  return core.write(['event'], async (w) => {
    const { event } = occurrence;
    if (!isRecurring(occurrence)) {
      const patch: RecordPatch<FamilyEvent> =
        draft.repeat === 'none'
          ? { ...fields, rrule: undefined, exDates: undefined }
          : { ...fields, rrule: buildRRule(draft.repeat), exDates: event.exDates ?? [] };
      return w.update('event', event.id, patch);
    }
    if (scope === 'all') {
      const master = event.recurrenceParentId
        ? await w.get('event', event.recurrenceParentId)
        : event;
      if (!master) return w.update('event', event.id, fields);
      // The form shows the clicked occurrence's date; the series must keep its first date.
      const firstDate = master.isAllDay
        ? (master.allDayStartDate ?? master.startInstant.slice(0, 10))
        : instantToZoned(master.startInstant, master.timeZone).date;
      const seriesDraft: EventDraft = {
        ...draft,
        date: firstDate,
        endDate: addDays(firstDate, diffDays(draft.date, draft.endDate)),
      };
      return w.update('event', master.id, {
        ...draftFields(seriesDraft),
        rrule: draft.repeat === 'none' ? undefined : buildRRule(draft.repeat),
      });
    }
    if (event.recurrenceParentId) return w.update('event', event.id, fields);
    return w.insert('event', {
      ...fields,
      createdById: event.createdById,
      recurrenceParentId: event.id,
      recurrenceId: occurrence.recurrenceId,
    });
  });
}

async function removeSeries(w: Writer, core: RepositoryCore, masterId: string): Promise<void> {
  const overrides = await core.db.events.where('recurrenceParentId').equals(masterId).toArray();
  for (const o of overrides) if (o.deletedAt === undefined) await w.remove('event', o.id);
  await w.remove('event', masterId);
}

/** Deletes a plain event, a whole series, or one occurrence (exDate on the master). */
export function deleteEvent(
  core: RepositoryCore,
  occurrence: Occurrence,
  scope: EditScope,
): Promise<void> {
  return core.write(['event'], async (w) => {
    const { event } = occurrence;
    if (!isRecurring(occurrence)) {
      await w.remove('event', event.id);
      return;
    }
    const masterId = event.recurrenceParentId ?? event.id;
    if (scope === 'all') {
      await removeSeries(w, core, masterId);
      return;
    }
    if (event.recurrenceParentId) await w.remove('event', event.id);
    const master = await w.get('event', masterId);
    if (master && master.deletedAt === undefined && occurrence.recurrenceId) {
      await w.update('event', masterId, {
        exDates: [...new Set([...(master.exDates ?? []), occurrence.recurrenceId])],
      });
    }
  });
}
