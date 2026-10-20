'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { EventDialog as Dialog } from './EventDialog';

// The editor (Radix Dialog + form + linked items) loads on first open (SPEC §9 budget).
const EventDialog = dynamic(() => import('./EventDialog').then((m) => m.EventDialog), {
  ssr: false,
});

export function LazyEventDialog(props: ComponentProps<typeof Dialog>) {
  return props.state === null ? null : <EventDialog {...props} />;
}
