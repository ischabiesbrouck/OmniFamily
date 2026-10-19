import type { Entity, RepositoryCore } from './core';

export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAST_SWEEP_KEY = 'lastTombstoneSweepAt';
const SYNCABLE: readonly Entity[] = ['event', 'task', 'grocery', 'member', 'device', 'points'];

/**
 * Purges tombstones older than 90 days (SPEC §5.4) together with their outbox rows.
 * This is the only code path allowed to hard-delete a syncable record.
 */
export async function sweepTombstones(core: RepositoryCore, now: number): Promise<number> {
  const { db } = core;
  const cutoff = now - TOMBSTONE_TTL_MS;
  const tables = SYNCABLE.map((e) => db.tableFor(e));
  return db.transaction('rw', [...tables, db.outbox, db.settings], async () => {
    let purged = 0;
    for (const table of tables) {
      const ids = await table.where('deletedAt').below(cutoff).primaryKeys();
      if (ids.length === 0) continue;
      await table.bulkDelete(ids);
      await db.outbox.where('recordId').anyOf(ids).delete();
      purged += ids.length;
    }
    await db.settings.put({ key: LAST_SWEEP_KEY, value: now });
    return purged;
  });
}

/** Runs the sweep at most once per 24 h; call on app start. */
export async function maybeSweepTombstones(core: RepositoryCore, now: number): Promise<number> {
  const last = await core.db.settings.get(LAST_SWEEP_KEY);
  if (typeof last?.value === 'number' && now - last.value < SWEEP_INTERVAL_MS) return 0;
  return sweepTombstones(core, now);
}
