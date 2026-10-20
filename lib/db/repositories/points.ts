import type { PointsLedgerEntry } from '../schema';
import type { RepositoryCore } from './core';

/** Balances per member: the sum of live ledger entries. Never stored as a counter. */
export function balances(entries: readonly PointsLedgerEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (e.deletedAt !== undefined) continue;
    totals.set(e.memberId, (totals.get(e.memberId) ?? 0) + e.delta);
  }
  return totals;
}

export function adjustPoints(
  core: RepositoryCore,
  memberId: string,
  delta: number,
  reason: 'manual_adjustment' | 'reward_redeemed',
): Promise<PointsLedgerEntry> {
  if (!Number.isInteger(delta) || delta === 0)
    throw new RangeError('delta must be a non-zero integer');
  return core.write(['points'], (w) => w.insert('points', { memberId, delta, reason }));
}
