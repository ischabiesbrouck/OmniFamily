// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createEphemeralKeys, derivePairingSecret } from '@/lib/crypto/pairing';
import { createEvent, type EventDraft } from '@/lib/db/repositories/events';
import { createHousehold, getHousehold } from '@/lib/db/repositories/household';
import { createTask, setTaskCompleted } from '@/lib/db/repositories/tasks';
import { memoryChannelPair, type SyncChannel } from '@/lib/sync/channel';
import { SyncError, SyncSession } from '@/lib/sync/syncEngine';
import { setupRepositories } from './helpers';

const FAST = { pinIterations: 1_000 };
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
  repeat: 'WEEKLY',
  createdById: 'm',
};

async function eventually<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  ms = 3_000,
): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out; last value ${JSON.stringify(value)}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function pairingKeys() {
  const a = await createEphemeralKeys();
  const b = await createEphemeralKeys();
  return [
    (await derivePairingSecret(a, b.publicKey, a.publicKey, b.publicKey)).key,
    (await derivePairingSecret(b, a.publicKey, a.publicKey, b.publicKey)).key,
  ] as const;
}

/** Records every wire message so tests can assert nothing leaves in plaintext. */
function tap(channel: SyncChannel, log: string[]): SyncChannel {
  return {
    send: (m) => {
      log.push(m);
      channel.send(m);
    },
    setHandlers: (onMessage, onClose) => channel.setHandlers(onMessage, onClose),
    close: () => channel.close(),
  };
}

async function connect(
  a: ReturnType<typeof setupRepositories>,
  b: ReturnType<typeof setupRepositories>,
  wire: string[] = [],
  dropAfter?: number,
) {
  const [chA, chB] = memoryChannelPair(dropAfter === undefined ? {} : { dropAfter });
  const [keyA, keyB] = await pairingKeys();
  const sa = new SyncSession(a.repos.core, tap(chA, wire), keyA, { deviceName: 'Kitchen' });
  const sb = new SyncSession(b.repos.core, tap(chB, wire), keyB, { deviceName: 'Phone' });
  return { sa, sb, started: Promise.all([sa.start(), sb.start()]) };
}

async function householdA() {
  const a = setupRepositories();
  const { members } = await createHousehold(
    a.repos.core,
    {
      householdName: 'De Vries',
      deviceName: 'Kitchen',
      members: [
        { name: 'Anna', colorHex: '#1e40af', role: 'parent', pin: '4321' },
        { name: 'Sem', colorHex: '#9f1239', role: 'child' },
      ],
    },
    FAST,
  );
  return { a, members };
}

describe('pairing: full vault transfer', () => {
  it('device B receives device A’s vault, then a subsequent edit', async () => {
    const { a } = await householdA();
    const event = await createEvent(a.repos.core, draft);
    const b = setupRepositories();
    const wire: string[] = [];
    const { sa, sb, started } = await connect(a, b, wire);
    await started;

    const hA = await getHousehold(a.db);
    const hB = await getHousehold(b.db);
    expect(hB).toMatchObject({
      householdId: hA?.householdId,
      householdName: 'De Vries',
      isMasterDevice: false,
    });
    expect(hB?.deviceId).not.toBe(hA?.deviceId);
    expect((await b.repos.members.list()).map((m) => m.name).sort()).toEqual(['Anna', 'Sem']);
    expect((await b.repos.events.get(event.id))?.title).toBe('Swimming');
    // B's own device record travelled back to A
    await eventually(
      () => a.repos.devices.list(),
      (d) => d.length === 2,
    );

    // subsequent edit on A arrives live on B
    await a.repos.events.update(event.id, { title: 'Swimming lesson' });
    await eventually(
      () => b.repos.events.get(event.id),
      (e) => e?.title === 'Swimming lesson',
    );
    // ...and the other way round
    await b.repos.events.update(event.id, { location: 'De Mirandabad' });
    await eventually(
      () => a.repos.events.get(event.id),
      (e) => e?.location === 'De Mirandabad',
    );

    // A's outbox drains once B acknowledged; records are marked synced
    await eventually(
      () => a.db.outbox.count(),
      (n) => n === 0,
    );
    expect((await a.repos.events.get(event.id))?.syncStatus).toBe('synced');

    // §5.5: nothing on the wire is readable
    expect(wire.length).toBeGreaterThan(3);
    for (const m of wire) {
      expect(m).not.toMatch(/Swimming|Anna|De Vries|4321|pbkdf2/);
    }
    sa.close();
    sb.close();
  });

  it('refuses to merge two different households (N2)', async () => {
    const { a } = await householdA();
    const { a: other } = await householdA();
    const { started } = await connect(a, other);
    await expect(started).rejects.toBeInstanceOf(SyncError);
  });
});

describe('conflict resolution', () => {
  async function pairedThenOffline() {
    const { a, members } = await householdA();
    const b = setupRepositories();
    const first = await connect(a, b);
    await first.started;
    first.sa.close();
    first.sb.close();
    return { a, b, members };
  }

  it('concurrent edits converge on the higher HLC on both devices', async () => {
    const { a, b } = await pairedThenOffline();
    const [event] = await a.repos.events
      .list()
      .then(async (l) => (l.length ? l : [await createEvent(a.repos.core, draft)]));
    const again = await connect(a, b);
    await again.started;
    again.sa.close();
    again.sb.close();

    await a.repos.events.update(event!.id, { title: 'From A' });
    b.clock.now += 5_000; // B edits later by its clock
    await b.repos.events.update(event!.id, { title: 'From B' });

    const sync = await connect(a, b);
    await sync.started;
    expect((await a.repos.events.get(event!.id))?.title).toBe('From B');
    expect((await b.repos.events.get(event!.id))?.title).toBe('From B');
    sync.sa.close();
    sync.sb.close();
  });

  it('task completion merges per field: a rename elsewhere does not undo it', async () => {
    const { a, b, members } = await pairedThenOffline();
    const task = await createTask(a.repos.core, {
      title: 'Dishes',
      timeZone: 'UTC',
      assigneeId: members[1]!.id,
      pointsValue: 5,
    });
    const s1 = await connect(a, b);
    await s1.started;
    s1.sa.close();
    s1.sb.close();

    await setTaskCompleted(a.repos.core, task.id, true, members[1]!.id); // A: completed
    b.clock.now += 60_000;
    await b.repos.tasks.update(task.id, { title: 'Dishes + pans' }); // B: later rename

    const s2 = await connect(a, b);
    await s2.started;
    for (const side of [a, b]) {
      const merged = await side.repos.tasks.get(task.id);
      expect(merged).toMatchObject({ title: 'Dishes + pans', completed: true });
    }
    s2.sa.close();
    s2.sb.close();
  });

  it('the same chore completed on both devices while apart pays out once', async () => {
    const { a, b, members } = await pairedThenOffline();
    const task = await createTask(a.repos.core, {
      title: 'Feed cat',
      timeZone: 'UTC',
      assigneeId: members[1]!.id,
      pointsValue: 3,
    });
    const s1 = await connect(a, b);
    await s1.started;
    s1.sa.close();
    s1.sb.close();

    await setTaskCompleted(a.repos.core, task.id, true, members[0]!.id);
    await setTaskCompleted(b.repos.core, task.id, true, members[1]!.id);
    const s2 = await connect(a, b);
    await s2.started;
    for (const side of [a, b]) {
      const entries = await side.repos.points.list();
      expect(entries.map((e) => e.delta)).toEqual([3]);
    }
    s2.sa.close();
    s2.sb.close();
  });

  it('deletes propagate as tombstones', async () => {
    const { a, b } = await pairedThenOffline();
    const event = await createEvent(a.repos.core, draft);
    const s1 = await connect(a, b);
    await s1.started;
    await b.repos.events.remove(event.id);
    await eventually(
      () => a.repos.events.get(event.id),
      (e) => e === undefined,
    );
    expect((await a.db.events.get(event.id))?.deletedAt).toBeDefined();
    s1.sa.close();
    s1.sb.close();
  });
});

describe('resumability (§5.6)', () => {
  it('a cut-off first join leaves no half-joined records behind', async () => {
    const { a } = await householdA();
    const b = setupRepositories();
    const broken = await connect(a, b, [], 4);
    await expect(broken.started).rejects.toBeInstanceOf(SyncError);
    // B may have joined, but holds no torn records; the next connect completes it.
    expect((await b.repos.events.list()).every((e) => e.title === draft.title)).toBe(true);
    const retry = await connect(a, b);
    await retry.started;
    expect((await b.repos.members.list()).map((m) => m.name).sort()).toEqual(['Anna', 'Sem']);
    retry.sa.close();
    retry.sb.close();
  });

  it('a sync cut off half-way leaves a consistent vault and the next connect converges', async () => {
    const { a } = await householdA();
    const b = setupRepositories();
    const pair = await connect(a, b);
    await pair.started;
    pair.sa.close();
    pair.sb.close();
    for (let i = 0; i < 250; i += 1)
      await createEvent(a.repos.core, { ...draft, title: `Event ${i}`, repeat: 'none' });

    const broken = await connect(a, b, [], 4); // hello, hello, then the first record batches — cut
    await expect(broken.started).rejects.toBeInstanceOf(SyncError);
    await new Promise((r) => setTimeout(r, 50));
    const partial = await b.repos.events.list();
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(250);
    expect(partial.every((e) => e.title.startsWith('Event ') && e.syncStatus === 'synced')).toBe(
      true,
    );

    const retry = await connect(a, b);
    await retry.started;
    expect(await b.repos.events.list()).toHaveLength(250);
    // replaying everything again is a no-op
    const again = await connect(a, b);
    await again.started;
    expect(await b.repos.events.list()).toHaveLength(250);
    for (const s of [retry, again]) {
      s.sa.close();
      s.sb.close();
    }
  });
});
