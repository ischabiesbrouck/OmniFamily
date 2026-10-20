/// <reference lib="webworker" />
import { NexusDB } from '@/lib/db/schema';
import { claimDueReminders, PERIODIC_SYNC_TAG, reminderBody } from './reminders';

/** Periodic Background Sync is Chromium-only and not in TypeScript's lib yet. */
interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string;
}

async function showDueReminders(scope: ServiceWorkerGlobalScope): Promise<void> {
  const db = new NexusDB();
  try {
    for (const reminder of await claimDueReminders(db, Date.now())) {
      await scope.registration.showNotification(reminder.title, {
        body: reminderBody(reminder),
        tag: reminder.key,
        data: { url: '/calendar?view=day' },
      });
    }
  } finally {
    db.close();
  }
}

export function handlePeriodicReminders(scope: ServiceWorkerGlobalScope): void {
  scope.addEventListener('periodicsync', (event) => {
    const e = event as PeriodicSyncEvent;
    if (e.tag === PERIODIC_SYNC_TAG) e.waitUntil(showDueReminders(scope));
  });

  scope.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
      (async () => {
        const windows = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const open = windows[0];
        if (open) await open.focus();
        else await scope.clients.openWindow('/calendar?view=day');
      })(),
    );
  });
}
