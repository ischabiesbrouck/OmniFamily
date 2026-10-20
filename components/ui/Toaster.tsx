'use client';

import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';

const ICON = { success: CircleCheck, error: CircleAlert, info: Info } as const;

/**
 * Short confirmations ("Event added") in a polite live region. Non-interactive and
 * click-through, so a toast never covers a control (they dismiss themselves).
 */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-8"
    >
      {toasts.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <p
            key={t.id}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-ink px-4 py-2 font-medium text-canvas shadow-float"
          >
            <Icon aria-hidden="true" className="size-5" />
            {t.message}
          </p>
        );
      })}
    </div>
  );
}
