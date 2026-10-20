'use client';

import { useEffect } from 'react';
import { getRepositories } from '@/lib/db/repositories';
import { claimDueReminders, reminderBody } from '@/lib/notifications/reminders';

const CHECK_EVERY_MS = 30_000;

/** Foreground half of D8: while the app is open, show due reminders every 30 s. */
export function useReminderScheduler(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || Notification.permission !== 'granted') return;
      const due = await claimDueReminders(getRepositories().core.db, Date.now());
      if (due.length === 0) return;
      const registration =
        'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      for (const reminder of due) {
        const options = { body: reminderBody(reminder), tag: reminder.key };
        if (registration) await registration.showNotification(reminder.title, options);
        else new Notification(reminder.title, options);
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
}
