import type { FamilyEvent, NexusDB } from '@/lib/db/schema';
import { occurrencesInWindow } from '@/lib/recurrence/expand';

/**
 * Local event reminders (SPEC D8). No push server: the open app checks every half minute,
 * and where Periodic Background Sync exists the service worker checks in the background.
 */
export const REMINDER_LEAD_MS = 15 * 60 * 1000;
export const REMINDERS_ENABLED_KEY = 'remindersEnabled';
export const NOTIFIED_KEY = 'notifiedReminders';
export const PERIODIC_SYNC_TAG = 'omnifamily-reminders';
const KEEP_NOTIFIED_MS = 2 * 24 * 60 * 60 * 1000;

export interface Reminder {
  key: string;
  title: string;
  start: number;
  location?: string;
}

/** Timed, family-visible occurrences starting within the lead time that were not notified yet. */
export function dueReminders(
  events: readonly FamilyEvent[],
  now: number,
  notified: ReadonlySet<string>,
  leadMs: number = REMINDER_LEAD_MS,
): Reminder[] {
  return occurrencesInWindow(events, { start: now, end: now + leadMs + 1 }, 'UTC')
    .filter((o) => !o.isAllDay && o.event.visibility === 'family')
    .filter((o) => o.start >= now && o.start - leadMs <= now && !notified.has(o.key))
    .map((o) => ({
      key: o.key,
      title: o.event.title,
      start: o.start,
      ...(o.event.location ? { location: o.event.location } : {}),
    }));
}

function notifiedMap(value: unknown): Map<string, number> {
  if (typeof value !== 'object' || value === null) return new Map();
  return new Map(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    ),
  );
}

/**
 * Finds due reminders and marks them notified in ONE transaction, so the page and the
 * service worker can both poll without ever showing the same reminder twice.
 */
export async function claimDueReminders(db: NexusDB, now: number): Promise<Reminder[]> {
  return db.transaction('rw', [db.events, db.settings], async () => {
    const enabled = await db.settings.get(REMINDERS_ENABLED_KEY);
    if (enabled?.value !== true) return [];
    const events = await db.events.filter((e) => e.deletedAt === undefined).toArray();
    const notified = notifiedMap((await db.settings.get(NOTIFIED_KEY))?.value);
    const due = dueReminders(events, now, new Set(notified.keys()));
    for (const r of due) notified.set(r.key, now);
    for (const [key, at] of notified) if (now - at > KEEP_NOTIFIED_MS) notified.delete(key);
    await db.settings.put({ key: NOTIFIED_KEY, value: Object.fromEntries(notified) });
    return due;
  });
}

export function reminderBody(reminder: Reminder, locale?: string): string {
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    reminder.start,
  );
  return reminder.location ? `${time} · ${reminder.location}` : time;
}
