import type { EntityRecordMap, FamilyTask, Syncable } from '@/lib/db/schema';
import { compareHlc } from './hlc';

export type SyncEntity = keyof EntityRecordMap;
export const SYNC_ENTITIES: readonly SyncEntity[] = [
  'device',
  'member',
  'event',
  'task',
  'grocery',
  'points',
];

/** Fields of a task that merge as one group on `completedHlc` (SPEC §5.3). */
const COMPLETION_FIELDS = [
  'completed',
  'completedAt',
  'completedBy',
  'completedHlc',
  'completionGen',
] as const;

function completionClock(task: FamilyTask): string {
  return task.completedHlc ?? '';
}

/**
 * Last-writer-wins by `hlc` (ties fall to the deviceId inside the HLC). Tasks merge their
 * completion fields separately, so a completion on one device survives a rename on another.
 */
export function mergeRecords<T extends Syncable>(
  entity: SyncEntity,
  local: T | undefined,
  remote: T,
): T {
  if (!local) return remote;
  const winner = compareHlc(remote.hlc, local.hlc) >= 0 ? remote : local;
  if (entity !== 'task') return winner;

  const l = local as unknown as FamilyTask;
  const r = remote as unknown as FamilyTask;
  const completionSource = compareHlc(completionClock(r), completionClock(l)) >= 0 ? r : l;
  const merged: Record<string, unknown> = { ...(winner as unknown as Record<string, unknown>) };
  for (const field of COMPLETION_FIELDS) {
    if (completionSource[field] === undefined) delete merged[field];
    else merged[field] = completionSource[field];
  }
  return merged as unknown as T;
}

/** Key-order-independent JSON, recursively (JSON.stringify's key list would filter nested keys). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** True if merging `remote` into `local` changes anything stored locally (syncStatus aside). */
export function changes<T extends Syncable>(local: T | undefined, merged: T): boolean {
  if (!local) return true;
  return canonical({ ...local, syncStatus: null }) !== canonical({ ...merged, syncStatus: null });
}
