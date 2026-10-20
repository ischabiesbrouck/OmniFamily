'use client';

import { useTranslations } from 'next-intl';
import { useSyncStore } from '@/stores/syncStore';

export function SyncStatus() {
  const t = useTranslations('sync.state');
  const state = useSyncStore((s) => s.state);
  const peerName = useSyncStore((s) => s.peerName);
  if (state === 'idle') return null;
  return (
    <span role="status" className="rounded-full border border-ink/30 px-3 py-1 text-sm font-medium">
      {state === 'live' ? t('live', { name: peerName ?? '' }) : t(state)}
    </span>
  );
}
