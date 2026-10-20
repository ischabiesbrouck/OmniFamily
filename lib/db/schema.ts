import Dexie, { type EntityTable, type Table } from 'dexie';
import { migrations } from './migrations';

/** SPEC §4. Every type here is the canonical shape of a stored record. */

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';

export interface Syncable {
  id: string; // UUIDv4, generated client-side
  hlc: string; // hybrid logical clock — the LWW ordering key (D4)
  updatedAt: number; // epoch ms, DISPLAY ONLY
  deletedAt?: number; // tombstone marker
  syncStatus: SyncStatus;
}

export interface HouseholdContext {
  householdId: string;
  householdName: string;
  deviceId: string;
  isMasterDevice: boolean;
  createdAt: number;
}

export interface Device extends Syncable {
  name: string;
  publicKeyJwk: JsonWebKey;
  lastSeenAt?: number;
  revoked: boolean;
}

export type MemberRole = 'parent' | 'child' | 'guest';

export interface FamilyMember extends Syncable {
  name: string;
  colorHex: string;
  avatarBlobId?: string; // local Blob, never a remote URL
  role: MemberRole;
  pinSalt?: string;
  pinHash?: string; // PBKDF2 per D5
}

export interface FamilyEvent extends Syncable {
  title: string;
  description?: string;
  startInstant: string; // UTC ISO-8601
  endInstant: string;
  timeZone: string; // IANA, e.g. "Europe/Amsterdam"
  isAllDay: boolean;
  allDayStartDate?: string; // YYYY-MM-DD when isAllDay
  allDayEndDate?: string;
  location?: string;
  memberIds: string[];
  visibility: 'family' | 'private';
  createdById: string;
  rrule?: string;
  exDates?: string[];
  recurrenceParentId?: string;
  recurrenceId?: string;
  linkedTaskIds?: string[];
  linkedGroceryIds?: string[];
}

export interface FamilyTask extends Syncable {
  title: string;
  dueInstant?: string;
  timeZone?: string;
  assigneeId?: string;
  completed: boolean;
  completedAt?: number;
  completedBy?: string;
  pointsValue?: number;
  eventId?: string;
  /** HLC of the last completion change: `completed*` fields merge on this, per field (§5.3). */
  completedHlc?: string;
  /** Bumped on every completion toggle; makes ledger entry ids deterministic (D-6.4). */
  completionGen?: number;
}

export const GROCERY_CATEGORIES = [
  'Produce',
  'Dairy',
  'Pantry',
  'Frozen',
  'Household',
  'Other',
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export interface GroceryItem extends Syncable {
  name: string;
  category: GroceryCategory;
  quantity?: string;
  purchased: boolean;
  addedByMemberId: string;
  associatedEventId?: string;
}

export interface PointsLedgerEntry extends Syncable {
  memberId: string;
  delta: number;
  reason: 'task_completed' | 'manual_adjustment' | 'reward_redeemed';
  taskId?: string;
}

export type OutboxEntity = 'event' | 'task' | 'grocery' | 'member' | 'device' | 'points';
export type OutboxOp = 'insert' | 'update' | 'delete';

export interface OutboxEntry {
  seq: number; // ++auto
  entity: OutboxEntity;
  recordId: string;
  op: OutboxOp;
  payloadCiphertext: ArrayBuffer;
  createdAt: number;
  attempts: number;
}

export interface ParsedFamilyEntry {
  title: string;
  startInstant: string;
  endInstant: string;
  timeZone: string;
  isAllDay: boolean;
  location?: string;
  assigneeIds: string[];
  confidenceScore: number; // 0–1
  linkedTasks?: Array<{ title: string; assigneeId?: string }>;
  linkedGroceries?: Array<{ item: string; category?: GroceryCategory }>;
  rawContextSnippet?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface EntityRecordMap {
  event: FamilyEvent;
  task: FamilyTask;
  grocery: GroceryItem;
  member: FamilyMember;
  device: Device;
  points: PointsLedgerEntry;
}

export const DB_NAME = 'omnifamily-nexus';

export class NexusDB extends Dexie {
  household!: EntityTable<HouseholdContext, 'householdId'>;
  devices!: Table<Device, string>;
  members!: Table<FamilyMember, string>;
  events!: Table<FamilyEvent, string>;
  tasks!: Table<FamilyTask, string>;
  groceries!: Table<GroceryItem, string>;
  points!: Table<PointsLedgerEntry, string>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    for (const migration of migrations) {
      const version = this.version(migration.version).stores(migration.stores);
      if (migration.upgrade) version.upgrade(migration.upgrade);
    }
  }

  /** Table holding the records of a syncable entity. */
  tableFor<E extends keyof EntityRecordMap>(entity: E): Table<EntityRecordMap[E], string> {
    const tables: { [K in keyof EntityRecordMap]: Table<EntityRecordMap[K], string> } = {
      event: this.events,
      task: this.tasks,
      grocery: this.groceries,
      member: this.members,
      device: this.devices,
      points: this.points,
    };
    return tables[entity];
  }
}
