'use client';

import { useState } from 'react';

/**
 * Paints a toggle immediately (SPEC S2: local write → paint < 50 ms) and lets the live
 * IndexedDB value take over once it catches up; a failed write rolls the paint back.
 */
export function useOptimisticToggle(
  stored: boolean,
  write: (next: boolean) => Promise<unknown>,
): [boolean, (next: boolean) => void] {
  const [pending, setPending] = useState<boolean | null>(null);
  if (pending !== null && pending === stored) setPending(null);

  const toggle = (next: boolean) => {
    setPending(next);
    write(next).catch(() => setPending(null));
  };
  return [pending ?? stored, toggle];
}
