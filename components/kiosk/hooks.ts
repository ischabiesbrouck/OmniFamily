'use client';

import { useEffect, useRef, useState } from 'react';

/** Current time, re-rendered exactly at each minute boundary (no per-second ticking). */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id: number;
    const schedule = () => {
      id = window.setTimeout(
        () => {
          setNow(Date.now());
          schedule();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    schedule();
    return () => window.clearTimeout(id);
  }, []);
  return now;
}

/** Keeps the screen on (SPEC §6); the lock is dropped when hidden, so re-acquire on return. */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let active = true;
    const acquire = async () => {
      if (!active || document.visibilityState !== 'visible' || (sentinel && !sentinel.released))
        return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        sentinel = null; // e.g. battery saver; the display simply follows OS settings
      }
    };
    const onVisibility = () => void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
    };
  }, []);
}

const BURN_IN_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [2, 1],
  [1, 2],
  [0, 1],
  [-1, 0],
  [-2, -1],
  [-1, -2],
];

/** Moves the whole display by 1–2 px every 5 minutes against OLED/LCD burn-in (SPEC §6). */
export function useBurnInOffset(intervalMs = 5 * 60_000): readonly [number, number] {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setStep((s) => (s + 1) % BURN_IN_OFFSETS.length),
      intervalMs,
    );
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return BURN_IN_OFFSETS[step] ?? [0, 0];
}

/** Calls `onIdle` after `ms` without touch, mouse or key input. */
export function useIdle(ms: number, onIdle: () => void): void {
  const callback = useRef(onIdle);
  useEffect(() => {
    callback.current = onIdle;
  });
  useEffect(() => {
    let id = window.setTimeout(() => callback.current(), ms);
    const reset = () => {
      window.clearTimeout(id);
      id = window.setTimeout(() => callback.current(), ms);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    return () => {
      window.clearTimeout(id);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [ms]);
}
