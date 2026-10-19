import { describe, expect, it } from 'vitest';
import { decodePayload } from '@/lib/db/repositories/core';
import { RecordNotFoundError } from '@/lib/db/repositories';
import { sweepTombstones, TOMBSTONE_TTL_MS } from '@/lib/db/repositories/maintenance';
import { createRepositories } from '@/lib/db/repositories';
import { compareHlc, parseHlc } from '@/lib/sync/hlc';
import { setupRepositories } from './helpers';

const grocery = {
  name: 'Milk',
  category: 'Dairy' as const,
  purchased: false,
  addedByMemberId: 'm1',
};

describe('repositories: CRUD', () => {
  it('creates a record with sync metadata and an outbox row', async () => {
    const { db, repos, clock } = setupRepositories();
    const item = await repos.groceries.create(grocery);

    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.syncStatus).toBe('pending_insert');
    expect(item.updatedAt).toBe(clock.now);
    expect(parseHlc(item.hlc).pt).toBe(clock.now);
    expect(await repos.groceries.get(item.id)).toEqual(item);

    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      entity: 'grocery',
      recordId: item.id,
      op: 'insert',
      attempts: 0,
    });
    expect(decodePayload(outbox[0]?.payloadCiphertext ?? new ArrayBuffer(0))).toEqual(item);
  });

  it('updates fields, advances the HLC and keeps pending_insert until first sync', async () => {
    const { db, repos, clock } = setupRepositories();
    const item = await repos.groceries.create(grocery);
    clock.now += 1_000;
    const updated = await repos.groceries.update(item.id, { purchased: true, quantity: '2 L' });

    expect(updated).toMatchObject({
      purchased: true,
      quantity: '2 L',
      syncStatus: 'pending_insert',
    });
    expect(compareHlc(item.hlc, updated.hlc)).toBeLessThan(0);

    await db.groceries.update(item.id, { syncStatus: 'synced' });
    const again = await repos.groceries.update(item.id, { quantity: undefined });
    expect(again.syncStatus).toBe('pending_update');
    expect('quantity' in again).toBe(false);
    expect((await db.outbox.toArray()).map((r) => r.op)).toEqual(['insert', 'update', 'update']);
  });

  it('lists only live records', async () => {
    const { repos } = setupRepositories();
    const a = await repos.groceries.create(grocery);
    await repos.groceries.create({ ...grocery, name: 'Bread', category: 'Pantry' });
    await repos.groceries.remove(a.id);
    expect((await repos.groceries.list()).map((g) => g.name)).toEqual(['Bread']);
  });

  it('fails on unknown ids', async () => {
    const { repos } = setupRepositories();
    await expect(repos.tasks.update('nope', { title: 'x' })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
    await expect(repos.tasks.remove('nope')).rejects.toBeInstanceOf(RecordNotFoundError);
  });

  it('rolls back the record, outbox row and clock together when a write throws', async () => {
    const { db, repos } = setupRepositories();
    await expect(
      repos.core.write(['task'], async (w) => {
        await w.insert('task', { title: 'Half-done', completed: false });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.tasks.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('writes several entities atomically in one transaction', async () => {
    const { db, repos } = setupRepositories();
    const task = await repos.tasks.create({ title: 'Dishes', completed: false, pointsValue: 5 });
    await repos.core.write(['task', 'points'], async (w) => {
      await w.update('task', task.id, { completed: true });
      await w.insert('points', {
        memberId: 'm1',
        delta: 5,
        reason: 'task_completed',
        taskId: task.id,
      });
    });
    expect((await repos.tasks.get(task.id))?.completed).toBe(true);
    expect(await repos.points.list()).toHaveLength(1);
    expect(await db.outbox.count()).toBe(3);
  });

  it('refuses to touch a table not declared for the transaction', async () => {
    const { repos } = setupRepositories();
    await expect(repos.core.write(['task'], (w) => w.insert('grocery', grocery))).rejects.toThrow(
      /not declared/,
    );
  });
});

describe('repositories: tombstones', () => {
  it('soft-deletes: the row stays with deletedAt and pending_delete', async () => {
    const { db, repos, clock } = setupRepositories();
    const event = await repos.events.create({
      title: 'Swim',
      startInstant: '2026-10-24T17:00:00.000Z',
      endInstant: '2026-10-24T18:00:00.000Z',
      timeZone: 'Europe/Amsterdam',
      isAllDay: false,
      memberIds: ['m1'],
      visibility: 'family',
      createdById: 'm1',
    });
    clock.now += 10;
    await repos.events.remove(event.id);

    const raw = await db.events.get(event.id);
    expect(raw).toMatchObject({ deletedAt: clock.now, syncStatus: 'pending_delete' });
    expect(compareHlc(event.hlc, raw?.hlc ?? '')).toBeLessThan(0);
    expect(await repos.events.get(event.id)).toBeUndefined();
    await expect(repos.events.update(event.id, { title: 'x' })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
    expect((await db.outbox.toArray()).at(-1)).toMatchObject({ op: 'delete', recordId: event.id });
  });

  it('sweeps tombstones older than 90 days, and only those', async () => {
    const { db, repos, clock } = setupRepositories();
    const old = await repos.groceries.create(grocery);
    const recent = await repos.groceries.create({ ...grocery, name: 'Eggs' });
    const live = await repos.groceries.create({ ...grocery, name: 'Rice' });
    await repos.groceries.remove(old.id);
    clock.now += TOMBSTONE_TTL_MS;
    await repos.groceries.remove(recent.id);
    clock.now += 1;

    expect(await sweepTombstones(repos.core, clock.now)).toBe(1);
    expect(await db.groceries.get(old.id)).toBeUndefined();
    expect(await db.groceries.get(recent.id)).toBeDefined();
    expect(await repos.groceries.get(live.id)).toBeDefined();
    expect(await db.outbox.where('recordId').equals(old.id).count()).toBe(0);
  });
});

describe('repositories: persisted clock', () => {
  it('keeps the device id and stays monotonic across reloads even if the wall clock regresses', async () => {
    const { db, repos, clock } = setupRepositories();
    const first = await repos.tasks.create({ title: 'a', completed: false });

    const reloadedClock = { now: clock.now - 60_000 };
    const reloaded = createRepositories(db, { now: () => reloadedClock.now });
    const second = await reloaded.tasks.create({ title: 'b', completed: false });

    expect(parseHlc(second.hlc).deviceId).toBe(parseHlc(first.hlc).deviceId);
    expect(compareHlc(first.hlc, second.hlc)).toBeLessThan(0);
  });

  it('two tabs sharing one database never issue overlapping timestamps', async () => {
    const { db, repos, clock } = setupRepositories();
    const tabB = createRepositories(db, { now: () => clock.now });
    const stamps: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      stamps.push((await repos.tasks.create({ title: `a${i}`, completed: false })).hlc);
      stamps.push((await tabB.tasks.create({ title: `b${i}`, completed: false })).hlc);
    }
    expect(new Set(stamps).size).toBe(stamps.length);
    expect([...stamps].sort(compareHlc)).toEqual(stamps);
  });
});
