import type { Transaction } from 'dexie';

export interface Migration {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

/**
 * Versioned Dexie schema. Append a new entry for every change; never edit a shipped one.
 * v1 is declared exactly as SPEC §4 prescribes.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    stores: {
      household: 'householdId',
      devices: 'id, revoked, deletedAt',
      members: 'id, role, deletedAt',
      events: 'id, startInstant, recurrenceParentId, syncStatus, deletedAt, *memberIds',
      tasks: 'id, dueInstant, assigneeId, completed, syncStatus, deletedAt',
      groceries: 'id, category, purchased, syncStatus, deletedAt',
      points: 'id, memberId, deletedAt',
      outbox: '++seq, entity, recordId',
      settings: 'key',
    },
  },
];
