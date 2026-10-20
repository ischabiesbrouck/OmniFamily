'use client';

import { useTranslations } from 'next-intl';
import { useSyncStore } from '@/stores/syncStore';

const DOT = {
  online: 'bg-success',
  connecting: 'bg-warning',
  offline: 'bg-muted',
} as const;

export function SyncStatus() {
  const t = useTranslations('sync');
  const state = useSyncStore((s) => s.state);
  const peerName = useSyncStore((s) => s.peerName);
  const relay = useSyncStore((s) => s.relay);
  // A live LAN session is the more specific news; otherwise show internet sync.
  if (state === 'idle' && relay === 'off') return null;
  const label =
    state !== 'idle'
      ? state === 'live'
        ? t('state.live', { name: peerName ?? '' })
        : t(`state.${state}`)
      : t(`relay.${relay === 'off' ? 'offline' : relay}`);
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-sm font-medium"
    >
      {state === 'idle' && relay !== 'off' && (
        <span aria-hidden="true" className={`size-2 rounded-full ${DOT[relay]}`} />
      )}
      {label}
    </span>
  );
}
