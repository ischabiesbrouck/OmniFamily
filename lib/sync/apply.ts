import { HLC_STATE_KEY, isHlcState, type RepositoryCore } from '@/lib/db/repositories/core';
import type { Syncable } from '@/lib/db/schema';
import { compareHlc, HlcDriftError } from './hlc';
import { changes, mergeRecords, SYNC_ENTITIES, type SyncEntity } from './merge';

export interface RemoteItem {
  e: SyncEntity;
  r: Syncable;
}

function isRemoteItem(value: unknown): value is RemoteItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const r = v.r as Record<string, unknown> | undefined;
  return (
    typeof v.e === 'string' &&
    (SYNC_ENTITIES as readonly string[]).includes(v.e) &&
    typeof r === 'object' &&
    r !== null &&
    typeof r.id === 'string' &&
    typeof r.hlc === 'string'
  );
}

/**
 * Applies remote records in ONE transaction: LWW merge per record, the HLC advanced past
 * each remote stamp, and no outbox rows (these are not local mutations). Re-applying the
 * same batch is a no-op, so an interrupted transfer can simply be repeated (§5.6).
 */
export async function applyRemoteRecords(
  core: RepositoryCore,
  items: readonly unknown[],
): Promise<number> {
  const valid = items.filter(isRemoteItem);
  if (valid.length !== items.length) throw new Error('Malformed sync record');
  const clock = await core.clock();
  const { db } = core;
  const tables = SYNC_ENTITIES.map((e) => db.tableFor(e));

  return db.transaction('rw', [...tables, db.settings], async () => {
    const persisted = await db.settings.get(HLC_STATE_KEY);
    if (isHlcState(persisted?.value)) clock.observe(persisted.value);

    let applied = 0;
    for (const { e, r } of valid) {
      const table = db.tableFor(e);
      const local = (await table.get(r.id)) as Syncable | undefined;
      const merged = mergeRecords(e, local, r);
      try {
        clock.recv(r.hlc);
      } catch (error) {
        // A peer clock more than a day ahead must not drag ours with it; its data still merges.
        if (!(error instanceof HlcDriftError)) throw error;
      }
      if (!changes(local, merged)) continue;
      const keepPending =
        local !== undefined && local.syncStatus !== 'synced' && compareHlc(local.hlc, r.hlc) > 0;
      // The entity is only known at runtime, so the table is the union of all record types.
      await table.put({
        ...merged,
        syncStatus: keepPending ? local.syncStatus : 'synced',
      } as never);
      applied += 1;
    }
    await db.settings.put({ key: HLC_STATE_KEY, value: clock.snapshot() });
    return applied;
  });
}

/** Every syncable record on this device, tombstones included, for a full state exchange. */
export async function snapshotRecords(core: RepositoryCore): Promise<RemoteItem[]> {
  const items: RemoteItem[] = [];
  for (const e of SYNC_ENTITIES) {
    for (const r of await core.db.tableFor(e).toArray()) items.push({ e, r });
  }
  return items;
}

/** Marks outbox rows up to `seq` delivered: delete them and flag records with nothing left pending. */
export async function acknowledge(core: RepositoryCore, upToSeq: number): Promise<void> {
  const { db } = core;
  const tables = SYNC_ENTITIES.map((e) => db.tableFor(e));
  await db.transaction('rw', [...tables, db.outbox], async () => {
    const delivered = await db.outbox.where('seq').belowOrEqual(upToSeq).toArray();
    if (delivered.length === 0) return;
    await db.outbox.bulkDelete(delivered.map((row) => row.seq));
    for (const row of delivered) {
      if ((await db.outbox.where('recordId').equals(row.recordId).count()) > 0) continue;
      await db.tableFor(row.entity).update(row.recordId, { syncStatus: 'synced' });
    }
  });
}
