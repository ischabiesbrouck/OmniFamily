import type { Table } from 'dexie';
import { HybridLogicalClock, type HlcState } from '@/lib/sync/hlc';
import {
  NexusDB,
  type EntityRecordMap,
  type OutboxEntity,
  type HouseholdContext,
  type OutboxOp,
  type Syncable,
} from '../schema';

export const DEVICE_ID_KEY = 'deviceId';
export const HLC_STATE_KEY = 'hlcState';

export type Entity = OutboxEntity;
export type RecordOf<E extends Entity> = EntityRecordMap[E];

/** What callers supply when creating a record; sync metadata is filled in here. */
export type NewRecord<T extends Syncable> = Omit<T, keyof Syncable> & { id?: string };
/** Fields a caller may change. `undefined` clears an optional field. */
export type RecordPatch<T extends Syncable> = Partial<Omit<T, keyof Syncable>>;

export class RecordNotFoundError extends Error {
  constructor(entity: Entity, id: string) {
    super(`${entity} ${id} not found`);
    this.name = 'RecordNotFoundError';
  }
}

/** Operations available inside one atomic write. Each call stamps a fresh HLC. */
export interface Writer {
  readonly now: number;
  readonly deviceId: string;
  insert<E extends Entity>(entity: E, input: NewRecord<RecordOf<E>>): Promise<RecordOf<E>>;
  /** `stamp` names fields that receive this update's own HLC (e.g. `completedHlc`). */
  update<E extends Entity>(
    entity: E,
    id: string,
    patch: RecordPatch<RecordOf<E>>,
    stamp?: readonly string[],
  ): Promise<RecordOf<E>>;
  remove<E extends Entity>(entity: E, id: string): Promise<RecordOf<E>>;
  get<E extends Entity>(entity: E, id: string): Promise<RecordOf<E> | undefined>;
  /** Device-local rows written in the same transaction; never enqueued for sync. */
  setHousehold(context: HouseholdContext): Promise<void>;
  setSetting(key: string, value: unknown): Promise<void>;
}

export interface CoreOptions {
  now?: () => number;
  randomId?: () => string;
}

const encoder = new TextEncoder();

/** Outbox snapshot. Encrypted at the transport boundary, not here (DECISIONS.md D-1.3). */
export function encodePayload(record: Syncable): ArrayBuffer {
  return encoder.encode(JSON.stringify(record)).buffer;
}

export function decodePayload(payload: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(payload));
}

export function isHlcState(value: unknown): value is HlcState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.pt === 'number' && typeof v.c === 'number';
}

function withoutUndefined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

export function isLive<T extends Syncable>(record: T | undefined): record is T {
  return record !== undefined && record.deletedAt === undefined;
}

/**
 * Owns Dexie writes. Every mutation writes the record, an outbox row and the advanced HLC
 * state in ONE transaction (SPEC §5.1), so a crash can never leave one without the other.
 */
export class RepositoryCore {
  readonly db: NexusDB;
  private readonly now: () => number;
  private readonly randomId: () => string;
  private clockPromise: Promise<HybridLogicalClock> | undefined;

  constructor(db: NexusDB, options: CoreOptions = {}) {
    this.db = db;
    this.now = options.now ?? Date.now;
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
  }

  /** Injected wall clock, so callers and tests share one notion of "now". */
  time(): number {
    return this.now();
  }

  clock(): Promise<HybridLogicalClock> {
    this.clockPromise ??= this.loadClock();
    return this.clockPromise;
  }

  private async loadClock(): Promise<HybridLogicalClock> {
    return this.db.transaction('rw', this.db.settings, async () => {
      const existing = await this.db.settings.get(DEVICE_ID_KEY);
      let deviceId: string;
      if (typeof existing?.value === 'string') {
        deviceId = existing.value;
      } else {
        deviceId = this.randomId();
        await this.db.settings.put({ key: DEVICE_ID_KEY, value: deviceId });
      }
      const state = await this.db.settings.get(HLC_STATE_KEY);
      return new HybridLogicalClock(deviceId, {
        now: this.now,
        ...(isHlcState(state?.value) ? { state: state.value } : {}),
      });
    });
  }

  async write<R>(entities: readonly Entity[], fn: (writer: Writer) => Promise<R>): Promise<R> {
    const clock = await this.clock();
    const tables = [...new Set(entities)].map((e) => this.db.tableFor(e));
    const { db } = this;

    return db.transaction('rw', [...tables, db.outbox, db.settings, db.household], async () => {
      // Another tab may have advanced the clock; never issue a timestamp behind it.
      const persisted = await db.settings.get(HLC_STATE_KEY);
      if (isHlcState(persisted?.value)) clock.observe(persisted.value);

      const now = this.now();
      const table = <E extends Entity>(entity: E): Table<RecordOf<E>, string> => {
        if (!entities.includes(entity)) {
          throw new Error(`Entity "${entity}" was not declared for this write`);
        }
        return db.tableFor(entity);
      };
      const enqueue = (entity: Entity, op: OutboxOp, record: Syncable) =>
        db.outbox.add({
          entity,
          recordId: record.id,
          op,
          payloadCiphertext: encodePayload(record),
          createdAt: now,
          attempts: 0,
        });

      const writer: Writer = {
        now,
        deviceId: clock.deviceId,
        setHousehold: async (context) => {
          await db.household.put(context);
        },
        setSetting: async (key, value) => {
          await db.settings.put({ key, value });
        },
        get: async (entity, id) => table(entity).get(id),
        insert: async (entity, input) => {
          const record = withoutUndefined({
            ...input,
            id: input.id ?? this.randomId(),
            hlc: clock.send(),
            updatedAt: now,
            syncStatus: 'pending_insert',
          }) as unknown as RecordOf<typeof entity>;
          await table(entity).add(record);
          await enqueue(entity, 'insert', record);
          return record;
        },
        update: async (entity, id, patch, stamp = []) => {
          const current = await table(entity).get(id);
          if (!isLive(current)) throw new RecordNotFoundError(entity, id);
          const hlc = clock.send();
          const record = withoutUndefined({
            ...current,
            ...patch,
            ...Object.fromEntries(stamp.map((field) => [field, hlc])),
            id,
            hlc,
            updatedAt: now,
            syncStatus:
              current.syncStatus === 'pending_insert' ? 'pending_insert' : 'pending_update',
          }) as RecordOf<typeof entity>;
          await table(entity).put(record);
          await enqueue(entity, 'update', record);
          return record;
        },
        remove: async (entity, id) => {
          const current = await table(entity).get(id);
          if (!isLive(current)) throw new RecordNotFoundError(entity, id);
          const record = {
            ...current,
            hlc: clock.send(),
            updatedAt: now,
            deletedAt: now,
            syncStatus: 'pending_delete',
          } as RecordOf<typeof entity>;
          await table(entity).put(record);
          await enqueue(entity, 'delete', record);
          return record;
        },
      };

      const result = await fn(writer);
      await db.settings.put({ key: HLC_STATE_KEY, value: clock.snapshot() });
      return result;
    });
  }

  async get<E extends Entity>(entity: E, id: string): Promise<RecordOf<E> | undefined> {
    const record = await this.db.tableFor(entity).get(id);
    return isLive(record) ? record : undefined;
  }

  /** Live (non-tombstoned) records. */
  async list<E extends Entity>(entity: E): Promise<RecordOf<E>[]> {
    return this.db
      .tableFor(entity)
      .filter((record) => record.deletedAt === undefined)
      .toArray();
  }
}
