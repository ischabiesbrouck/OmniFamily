import type { NexusDB } from '@/lib/db/schema';

/**
 * Free public Nostr relays used as an encrypted mailbox (D-10.1). Several, so one going
 * down or forgetting events costs nothing; a build can replace them with
 * NEXT_PUBLIC_SYNC_RELAYS (comma-separated), which the e2e tests point at a local relay.
 */
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://offchain.pub',
] as const;

export function relayUrls(): string[] {
  const configured = (process.env.NEXT_PUBLIC_SYNC_RELAYS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => /^wss?:\/\//.test(u));
  return configured.length > 0 ? configured : [...DEFAULT_RELAYS];
}

/** Device-local switch (never synced): does this device sync over the internet? */
export const RELAY_SYNC_KEY = 'relaySync';
/** Last published snapshot: content hash, time and the event timestamp used. */
export const RELAY_STATE_KEY = 'relaySyncState';

export interface RelaySyncSetting {
  enabled: boolean;
}

export function isRelaySyncOn(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && (value as RelaySyncSetting).enabled === true
  );
}

export async function setRelaySync(db: NexusDB, enabled: boolean): Promise<void> {
  await db.settings.put({ key: RELAY_SYNC_KEY, value: { enabled } satisfies RelaySyncSetting });
}
