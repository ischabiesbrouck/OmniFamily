import type { ReactNode } from 'react';

/** The wall display has its own chrome-less layout (SPEC §3). */
export default function KioskLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-surface text-ink">{children}</div>;
}
