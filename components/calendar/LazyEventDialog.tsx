'use client';

import dynamic from 'next/dynamic';
import { useUiStore } from '@/stores/uiStore';

// The editor (Radix Dialog + form + linked items) loads on first open (SPEC §9 budget).
const EventEditor = dynamic(() => import('./EventDialog').then((m) => m.EventEditor), {
  ssr: false,
});

/** Mounted once in the app shell; renders nothing until an editor is opened. */
export function EventEditorHost() {
  const open = useUiStore((s) => s.editor !== null);
  return open ? <EventEditor /> : null;
}
