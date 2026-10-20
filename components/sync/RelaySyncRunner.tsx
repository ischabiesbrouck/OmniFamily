'use client';

import { useEffect } from 'react';
import { getRepositories } from '@/lib/db/repositories';
import { useHousehold, useSetting } from '@/lib/db/repositories/hooks';
import { isRelaySyncOn, RELAY_SYNC_KEY, relayUrls } from '@/lib/sync/relay/config';
import { useSyncStore } from '@/stores/syncStore';

/** Runs internet sync (D-10.1) in the background while it is switched on for this device. */
export default function RelaySyncRunner() {
  const household = useHousehold();
  const enabled = isRelaySyncOn(useSetting(RELAY_SYNC_KEY));
  const householdId = household?.householdId;

  useEffect(() => {
    const setRelay = useSyncStore.getState().setRelay;
    if (!enabled || !householdId) {
      setRelay('off');
      return;
    }
    let stop: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      // The relay engine (and its Schnorr signing) loads only on devices that use it.
      const { RelaySync } = await import('@/lib/sync/relay/relaySync');
      if (cancelled) return;
      const sync = new RelaySync(getRepositories().core, {
        relays: relayUrls(),
        onState: (state) => setRelay(state),
      });
      stop = () => sync.stop();
      await sync.start().catch(() => setRelay('offline'));
    })();
    return () => {
      cancelled = true;
      stop?.();
      setRelay('off');
    };
  }, [enabled, householdId]);

  return null;
}
