import { open, seal } from '@/lib/crypto/aead';
import { exportHouseholdKey, importHouseholdKey } from '@/lib/crypto/householdKey';
import type { RepositoryCore } from '@/lib/db/repositories/core';
import { ensureHouseholdKey, getHousehold, joinHousehold } from '@/lib/db/repositories/household';
import type { HouseholdContext } from '@/lib/db/schema';
import { setRelaySync } from './config';
export { inviteLink, parseInviteCode } from './inviteCode';
import { inviteKeys } from './keys';
import { APP_DATA_KIND, signEvent, type NostrEvent } from './nostr';
import type { RelayPool } from './pool';

/**
 * One-step device invites (D-10.4). The inviting device seals the household's id, name and
 * data key under a key derived from a random 128-bit secret and leaves it on the relays for
 * 15 minutes. The secret travels only in the QR code or link (as a URL fragment, which
 * browsers never send to a server), so the relays hold nothing they can open.
 */
export const INVITE_TTL_S = 15 * 60;
const INVITE_D = 'omnifamily-invite';
const AAD = 'omnifamily-invite-v1';

export class InviteError extends Error {
  constructor(readonly code: 'invalid' | 'not_found' | 'expired' | 'publish_failed') {
    super(code);
    this.name = 'InviteError';
  }
}

interface InvitePayload {
  v: 1;
  householdId: string;
  householdName: string;
  key: string;
  expiresAt: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export interface Invite {
  code: string;
  expiresAt: number;
  /** Replaces the invitation on the relays with an empty one once it has been used. */
  burn(): Promise<void>;
}

export async function createInvite(
  core: RepositoryCore,
  pool: RelayPool,
  now: number = Date.now(),
): Promise<Invite> {
  const household = await getHousehold(core.db);
  if (!household) throw new Error('No household on this device');
  const secret = crypto.getRandomValues(new Uint8Array(16));
  const keys = await inviteKeys(secret);
  const createdAt = Math.floor(now / 1_000);
  const expiresAt = createdAt + INVITE_TTL_S;
  const payload: InvitePayload = {
    v: 1,
    householdId: household.householdId,
    householdName: household.householdName,
    key: await exportHouseholdKey(await ensureHouseholdKey(core.db)),
    expiresAt,
  };
  const tags = [
    ['d', INVITE_D],
    // NIP-40: relays that support it delete the event after this time.
    ['expiration', String(expiresAt)],
  ];
  const event = await signEvent(
    {
      created_at: createdAt,
      kind: APP_DATA_KIND,
      tags,
      content: await seal(keys.aesKey, payload, AAD),
    },
    keys.secretKey,
  );
  if ((await pool.publish(event)) === 0) throw new InviteError('publish_failed');
  // The inviting device starts syncing over the internet too, so the new one finds its data.
  await setRelaySync(core.db, true);
  return {
    code: toBase64Url(secret),
    expiresAt: expiresAt * 1_000,
    async burn() {
      const empty = await signEvent(
        { created_at: createdAt + 1, kind: APP_DATA_KIND, tags, content: '' },
        keys.secretKey,
      );
      await pool.publish(empty, 5_000);
    },
  };
}

/** Finds the invitation on the relays, opens it and makes this empty device a member. */
export async function acceptInvite(
  core: RepositoryCore,
  pool: RelayPool,
  code: string,
  deviceName: string,
  options: { timeoutMs?: number; now?: number } = {},
): Promise<HouseholdContext> {
  let secret: Uint8Array<ArrayBuffer>;
  try {
    secret = fromBase64Url(code);
  } catch {
    throw new InviteError('invalid');
  }
  if (secret.length !== 16) throw new InviteError('invalid');
  const keys = await inviteKeys(secret);

  const event = await new Promise<NostrEvent | null>((resolve) => {
    let best: NostrEvent | null = null;
    const finish = () => {
      clearTimeout(timer);
      stop();
      resolve(best);
    };
    const timer = setTimeout(finish, options.timeoutMs ?? 20_000);
    const stop = pool.subscribe(
      [{ kinds: [APP_DATA_KIND], authors: [keys.pubkey] }],
      (e) => {
        if (best && best.created_at >= e.created_at) return;
        best = e;
        // Stop at the first live invitation. Burning is best effort; the expiry is the limit.
        if (e.content) finish();
      },
      finish,
    );
  });
  if (!event) throw new InviteError('not_found');
  if (!event.content) throw new InviteError('expired');

  let payload: InvitePayload;
  try {
    payload = (await open(keys.aesKey, event.content, AAD)) as InvitePayload;
  } catch {
    throw new InviteError('invalid');
  }
  if (payload.v !== 1 || typeof payload.key !== 'string') throw new InviteError('invalid');
  if (payload.expiresAt * 1_000 < (options.now ?? Date.now())) throw new InviteError('expired');

  const household = await joinHousehold(core, {
    householdId: payload.householdId,
    householdName: payload.householdName,
    householdKey: await importHouseholdKey(payload.key),
    deviceName,
  });
  await setRelaySync(core.db, true);
  return household;
}
