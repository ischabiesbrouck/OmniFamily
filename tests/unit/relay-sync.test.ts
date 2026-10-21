// @vitest-environment node
import { schnorr } from '@noble/curves/secp256k1.js';
import { afterEach, describe, expect, it } from 'vitest';
import { generateHouseholdKey } from '@/lib/crypto/householdKey';
import { createEvent, type EventDraft } from '@/lib/db/repositories/events';
import { createHousehold, getHousehold } from '@/lib/db/repositories/household';
import { isRelaySyncOn, RELAY_SYNC_KEY } from '@/lib/sync/relay/config';
import {
  acceptInvite,
  createInvite,
  InviteError,
  inviteLink,
  parseInviteCode,
} from '@/lib/sync/relay/invite';
import { formatInviteCode, newInviteCode } from '@/lib/sync/relay/inviteCode';
import { eventId, fromHex, signEvent } from '@/lib/sync/relay/nostr';
import { RelayPool } from '@/lib/sync/relay/pool';
import { RelaySync } from '@/lib/sync/relay/relaySync';
import { decodeSnapshot, encodeSnapshot } from '@/lib/sync/relay/snapshot';
import { FakeRelay } from './fakeRelay';
import { setupRepositories } from './helpers';

const FAST = { pinIterations: 1_000 };
const FAST_CODE = { iterations: 1_000 };
const draft: EventDraft = {
  title: 'Swimming',
  description: '',
  location: '',
  isAllDay: false,
  date: '2026-10-24',
  endDate: '2026-10-24',
  startTime: '19:00',
  endTime: '20:00',
  timeZone: 'Europe/Amsterdam',
  memberIds: [],
  visibility: 'family',
  repeat: 'none',
  createdById: 'm',
};

async function eventually<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  ms = 4_000,
): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out; last value ${JSON.stringify(value)}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

function poolFor(relays: FakeRelay[]): RelayPool {
  const byUrl = new Map(relays.map((r, i) => [`wss://relay${i}.test`, r]));
  const pool = new RelayPool([...byUrl.keys()], (url) => byUrl.get(url)!.socket());
  cleanup.push(() => pool.close());
  return pool;
}

function syncFor(core: ReturnType<typeof setupRepositories>['repos']['core'], relays: FakeRelay[]) {
  const byUrl = new Map(relays.map((r, i) => [`wss://relay${i}.test`, r]));
  const sync = new RelaySync(core, {
    relays: [...byUrl.keys()],
    socketFactory: (url) => byUrl.get(url)!.socket(),
    debounceMs: 5,
    retryMs: 20,
  });
  cleanup.push(() => sync.stop());
  return sync;
}

async function household(name = 'Kitchen') {
  const a = setupRepositories();
  await createHousehold(
    a.repos.core,
    {
      householdName: 'De Vries',
      deviceName: name,
      members: [{ name: 'Anna', colorHex: '#1e40af', role: 'parent' }],
    },
    FAST,
  );
  return a;
}

describe('nostr events', () => {
  it('are NIP-01 ids signed with BIP-340 Schnorr', async () => {
    const sk = fromHex('0000000000000000000000000000000000000000000000000000000000000003');
    const e = await signEvent(
      { created_at: 1, kind: 30078, tags: [['d', 'x']], content: 'hi' },
      sk,
    );
    expect(e.pubkey).toBe('f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9');
    expect(e.id).toBe(await eventId(e.pubkey, e));
    expect(schnorr.verify(fromHex(e.sig), fromHex(e.id), fromHex(e.pubkey))).toBe(true);
  });
});

describe('snapshots', () => {
  it('round-trip through several chunks and fail under another key', async () => {
    const key = await generateHouseholdKey();
    const value = Array.from({ length: 200 }, (_, i) => ({
      i,
      title: `Event ${i} ${Math.random()}`,
    }));
    const chunks = await encodeSnapshot(key, 'hh', value, 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(new Set(chunks.map((c) => c.s)).size).toBe(1);
    expect(await decodeSnapshot(key, 'hh', [...chunks].reverse())).toEqual(value);
    await expect(decodeSnapshot(await generateHouseholdKey(), 'hh', chunks)).rejects.toThrow();
    await expect(decodeSnapshot(key, 'other-household', chunks)).rejects.toThrow();
  });
});

describe('family codes', () => {
  it('are 10 Crockford Base32 characters, forgiving look-alikes, in a link or alone', () => {
    const code = newInviteCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(formatInviteCode('K7F2Q9XDM3')).toBe('K7F2Q-9XDM3');
    const link = inviteLink('K7F2Q9XDM3', 'https://x.test/OmniFamily/onboarding/');
    expect(link).toBe('https://x.test/OmniFamily/onboarding/#join=K7F2Q-9XDM3');
    expect(parseInviteCode(link)).toBe('K7F2Q9XDM3');
    expect(parseInviteCode(' k7f2q - 9xdm3 ')).toBe('K7F2Q9XDM3');
    expect(parseInviteCode('O0IL1-ABCDE')).toBe('00111ABCDE');
    expect(parseInviteCode('K7F2Q-9XDM')).toBeNull();
    expect(parseInviteCode('K7F2Q-9XDMU')).toBeNull();
    expect(parseInviteCode('OF1/1/1/XYZ')).toBeNull();
  });
});

describe('invites', () => {
  it('let a new device join by code; relays never see the key or the members', async () => {
    const relay = new FakeRelay();
    const a = await household();
    const invite = await createInvite(a.repos.core, poolFor([relay]), FAST_CODE);
    expect(isRelaySyncOn((await a.db.settings.get(RELAY_SYNC_KEY))?.value)).toBe(true);

    const b = setupRepositories();
    const joined = await acceptInvite(
      b.repos.core,
      poolFor([relay]),
      formatInviteCode(invite.code).toLowerCase(),
      'Phone',
      FAST_CODE,
    );
    expect(joined.householdId).toBe((await getHousehold(a.db))?.householdId);
    expect(isRelaySyncOn((await b.db.settings.get(RELAY_SYNC_KEY))?.value)).toBe(true);
    // The member list arrives with the invitation, before any sync.
    expect((await b.db.tableFor('member').toArray()).map((m) => m.name)).toEqual(['Anna']);
    expect(await b.db.outbox.count()).toBe(1); // only B's own device record
    expect(JSON.stringify(relay.events)).not.toMatch(/De Vries|Anna/);
    expect(JSON.stringify(relay.events)).not.toContain(invite.code);

    await invite.burn();
    const c = setupRepositories();
    await expect(
      acceptInvite(c.repos.core, poolFor([relay]), invite.code, 'Tablet', FAST_CODE),
    ).rejects.toThrow(InviteError);
    expect(await getHousehold(c.db)).toBeUndefined();
  });

  it('reject a malformed, unknown or expired code', async () => {
    const relay = new FakeRelay();
    const a = await household();
    const invite = await createInvite(a.repos.core, poolFor([relay]), FAST_CODE);
    const b = setupRepositories();
    await expect(
      acceptInvite(b.repos.core, poolFor([relay]), 'nonsense', 'P', FAST_CODE),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      acceptInvite(b.repos.core, poolFor([relay]), '00000-00000', 'P', {
        ...FAST_CODE,
        timeoutMs: 200,
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      acceptInvite(b.repos.core, poolFor([relay]), invite.code, 'P', {
        ...FAST_CODE,
        now: invite.expiresAt + 1,
      }),
    ).rejects.toMatchObject({ code: 'expired' });
  });
});

describe('relay sync', () => {
  async function pair(relays: FakeRelay[]) {
    const a = await household();
    const invite = await createInvite(a.repos.core, poolFor(relays), FAST_CODE);
    const b = setupRepositories();
    await acceptInvite(b.repos.core, poolFor(relays), invite.code, 'Phone', FAST_CODE);
    return { a, b };
  }

  it('carries edits both ways, encrypted, and clears the outbox once stored', async () => {
    const relays = [new FakeRelay(), new FakeRelay()];
    const { a, b } = await pair(relays);
    const sa = syncFor(a.repos.core, relays);
    const sb = syncFor(b.repos.core, relays);
    await Promise.all([sa.start(), sb.start()]);

    await createEvent(a.repos.core, draft);
    const onB = await eventually(
      () => b.db.tableFor('event').toArray(),
      (rows) => rows.length === 1,
    );
    expect(onB[0]?.title).toBe('Swimming');
    // B also learns about A's device and members.
    await eventually(
      () => b.db.tableFor('member').count(),
      (n) => n === 1,
    );

    await createEvent(b.repos.core, { ...draft, title: 'Dentist', date: '2026-10-26' });
    await eventually(
      () => a.db.tableFor('event').toArray(),
      (rows) => rows.some((r) => r.title === 'Dentist'),
    );
    await eventually(
      () => a.db.outbox.count(),
      (n) => n === 0,
    );
    expect(JSON.stringify(relays[0]?.events)).not.toMatch(/Swimming|Dentist|Anna/);
  });

  it('works when the devices are never online at the same time', async () => {
    const relays = [new FakeRelay()];
    const { a, b } = await pair(relays);
    const sa = syncFor(a.repos.core, relays);
    await sa.start();
    await createEvent(a.repos.core, draft);
    await eventually(
      () => a.db.outbox.count(),
      (n) => n === 0,
    );
    sa.stop();

    const sb = syncFor(b.repos.core, relays);
    await sb.start();
    await eventually(
      () => b.db.tableFor('event').count(),
      (n) => n === 1,
    );
  });

  it('keeps changes pending while relays refuse them, then delivers', async () => {
    const relay = new FakeRelay();
    const { a } = await pair([relay]);
    relay.accept = false;
    const sa = syncFor(a.repos.core, [relay]);
    await sa.start();
    await createEvent(a.repos.core, draft);
    await sa.flush();
    expect(await a.db.outbox.count()).toBeGreaterThan(0);

    relay.accept = true;
    await eventually(
      () => a.db.outbox.count(),
      (n) => n === 0,
    );
  });

  it('reconnects after a relay drops the connection', async () => {
    const relay = new FakeRelay();
    const { a, b } = await pair([relay]);
    const sa = syncFor(a.repos.core, [relay]);
    const sb = syncFor(b.repos.core, [relay]);
    await Promise.all([sa.start(), sb.start()]);
    await eventually(
      () => b.db.tableFor('member').count(),
      (n) => n === 1,
    );
    relay.disconnectAll();
    await createEvent(a.repos.core, draft);
    await eventually(
      () => b.db.tableFor('event').count(),
      (n) => n === 1,
      5_000,
    );
  });
});
