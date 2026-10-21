import { open, seal } from '@/lib/crypto/aead';
import { exportHouseholdKey, importHouseholdKey } from '@/lib/crypto/householdKey';
import type { RepositoryCore } from '@/lib/db/repositories/core';
import { ensureHouseholdKey, getHousehold, joinHousehold } from '@/lib/db/repositories/household';
import type { FamilyMember, HouseholdContext } from '@/lib/db/schema';
import { applyRemoteRecords } from '../apply';
import { setRelaySync } from './config';
import { newInviteCode, parseInviteCode } from './inviteCode';
import { inviteKeys } from './keys';
import { APP_DATA_KIND, signEvent, type NostrEvent } from './nostr';
import type { RelayPool } from './pool';

export { inviteLink, parseInviteCode } from './inviteCode';

/**
 * Joining a family by code or QR (D-10.4, D-10.8). The inviting device seals the household's
 * id, name, data key and member list under keys derived from a fresh family code and leaves
 * the result on the relays for 15 minutes. The code travels only on screen, in the QR code
 * or in the link's fragment (never sent to a web server), so relays hold nothing they can open.
 */
export const INVITE_TTL_S = 15 * 60;
const AAD = 'omnifamily-invite-v2';

export class InviteError extends Error {
  constructor(readonly code: 'invalid' | 'not_found' | 'expired' | 'publish_failed') {
    super(code);
    this.name = 'InviteError';
  }
}

interface InvitePayload {
  v: 2;
  householdId: string;
  householdName: string;
  key: string;
  expiresAt: number;
  /** So the new device can say "I am Sem" at once, before the first sync. */
  members: FamilyMember[];
}

export interface Invite {
  /** Canonical 10-character code; show it with `formatInviteCode`. */
  code: string;
  expiresAt: number;
  /** Replaces the invitation on the relays with an empty one once it has been used. */
  burn(): Promise<void>;
}

interface InviteOptions {
  now?: number;
  /** Test-only override of the PBKDF2 work factor. */
  iterations?: number;
}

export async function createInvite(
  core: RepositoryCore,
  pool: RelayPool,
  options: InviteOptions = {},
): Promise<Invite> {
  const { db } = core;
  const household = await getHousehold(db);
  if (!household) throw new Error('No household on this device');
  const code = newInviteCode();
  const keys = await inviteKeys(code, options.iterations);
  const createdAt = Math.floor((options.now ?? Date.now()) / 1_000);
  const expiresAt = createdAt + INVITE_TTL_S;
  const members = (await db.tableFor('member').toArray()).filter((m) => m.deletedAt === undefined);
  const payload: InvitePayload = {
    v: 2,
    householdId: household.householdId,
    householdName: household.householdName,
    key: await exportHouseholdKey(await ensureHouseholdKey(db)),
    expiresAt,
    members,
  };
  const tags = [
    ['d', keys.address],
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
  // The inviting device syncs over the internet too, so the new one finds its data.
  await setRelaySync(db, true);
  return {
    code,
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

/** Finds the invitation on the relays, opens it and makes this empty device part of the family. */
export async function acceptInvite(
  core: RepositoryCore,
  pool: RelayPool,
  typed: string,
  deviceName: string,
  options: InviteOptions & { timeoutMs?: number } = {},
): Promise<HouseholdContext> {
  const code = parseInviteCode(typed);
  if (!code) throw new InviteError('invalid');
  const keys = await inviteKeys(code, options.iterations);

  const event = await new Promise<NostrEvent | null>((resolve) => {
    let best: NostrEvent | null = null;
    let stop = () => {};
    const finish = () => {
      clearTimeout(timer);
      stop();
      resolve(best);
    };
    const timer = setTimeout(finish, options.timeoutMs ?? 20_000);
    stop = pool.subscribe(
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
  if (payload.v !== 2 || typeof payload.key !== 'string') throw new InviteError('invalid');
  if (payload.expiresAt * 1_000 < (options.now ?? Date.now())) throw new InviteError('expired');

  const household = await joinHousehold(core, {
    householdId: payload.householdId,
    householdName: payload.householdName,
    householdKey: await importHouseholdKey(payload.key),
    deviceName,
  });
  // Same LWW merge as sync, so the full snapshot that follows simply confirms these.
  if (Array.isArray(payload.members))
    await applyRemoteRecords(
      core,
      payload.members.map((r) => ({ e: 'member', r })),
    );
  await setRelaySync(core.db, true);
  return household;
}
