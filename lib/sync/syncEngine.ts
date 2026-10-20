import { liveQuery, type Subscription } from 'dexie';
import { open, seal } from '@/lib/crypto/aead';
import { exportHouseholdKey, importHouseholdKey } from '@/lib/crypto/pairing';
import type { RepositoryCore } from '@/lib/db/repositories/core';
import { ensureHouseholdKey, getHousehold, joinHousehold } from '@/lib/db/repositories/household';
import type { Syncable } from '@/lib/db/schema';
import { acknowledge, applyRemoteRecords, snapshotRecords, type RemoteItem } from './apply';
import type { SyncChannel } from './channel';

/**
 * Sync protocol over an encrypted, ordered channel (SPEC §5, D3).
 *
 *   hello    → both: who am I, which household (sealed with the pairing key)
 *   welcome  → device with a household → empty device: id, name, data key (pairing key)
 *   records  → both: full state, then live changes (sealed with the household key, AAD = id)
 *   ack      → receiver: "applied up to your outbox seq N" → sender clears its outbox
 *
 * State exchange is idempotent: every connect re-sends everything and LWW merges it, so a
 * transfer cut off half-way is repaired by the next connect (§5.6).
 */

export const PROTOCOL_VERSION = 1;
const BATCH_SIZE = 100;

type Plain =
  | { t: 'hello'; v: number; deviceId: string; deviceName: string; householdId: string | null }
  | { t: 'welcome'; householdId: string; householdName: string; key: string }
  | { t: 'records'; items: RemoteItem[]; initial: boolean; last: boolean; upToSeq: number }
  | { t: 'ack'; upToSeq: number };

type Envelope = { k: 'p' | 'h'; d: string };

export type SessionState = 'connecting' | 'joining' | 'transferring' | 'live' | 'closed' | 'failed';
export type SyncErrorCode = 'household_mismatch' | 'no_household' | 'protocol' | 'closed';

export class SyncError extends Error {
  constructor(
    readonly code: SyncErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'SyncError';
  }
}

export interface PeerInfo {
  deviceId: string;
  deviceName: string;
}

export interface SessionOptions {
  deviceName: string;
  onState?: (state: SessionState, error?: SyncError) => void;
  onApplied?: (count: number) => void;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {}); // observed via start(); avoid unhandled-rejection noise
  return { promise, resolve, reject };
}

function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.k === 'p' || v.k === 'h') && typeof v.d === 'string';
}

function isPlain(value: unknown): value is Plain {
  return (
    typeof value === 'object' && value !== null && typeof (value as { t?: unknown }).t === 'string'
  );
}

export class SyncSession {
  state: SessionState = 'connecting';
  peer: PeerInfo | undefined;
  private householdKey: CryptoKey | undefined;
  private householdId: string | undefined;
  private inbox: Promise<void> = Promise.resolve();
  private waiting = new Map<
    Plain['t'],
    { resolve: (m: Plain) => void; reject: (e: Error) => void }
  >();
  private early = new Map<Plain['t'], Plain>();
  /** Both created up front so a failure at any point rejects whoever waits on them. */
  private readonly peerSnapshot = deferred<void>();
  /** Household-key messages that arrive while we are still joining wait for this. */
  private readonly householdReady = deferred<void>();
  private sentSeq = 0;
  private subscription: Subscription | undefined;
  private pumping: Promise<void> = Promise.resolve();

  constructor(
    private readonly core: RepositoryCore,
    private readonly channel: SyncChannel,
    private readonly pairingKey: CryptoKey,
    private readonly options: SessionOptions,
  ) {
    channel.setHandlers(
      (message) => {
        this.inbox = this.inbox
          .then(() => this.receive(message))
          .catch((e: unknown) => this.fail(e));
      },
      () => this.fail(new SyncError('closed')),
    );
  }

  /** Resolves once both sides hold the same household and the full exchange is done. */
  async start(): Promise<void> {
    try {
      const { db } = this.core;
      const household = await getHousehold(db);
      const clock = await this.core.clock();
      await this.send('p', {
        t: 'hello',
        v: PROTOCOL_VERSION,
        deviceId: clock.deviceId,
        deviceName: this.options.deviceName,
        householdId: household?.householdId ?? null,
      });
      const hello = await this.expect('hello');
      if (hello.v !== PROTOCOL_VERSION) throw new SyncError('protocol', `peer speaks v${hello.v}`);
      this.peer = { deviceId: hello.deviceId, deviceName: hello.deviceName };

      if (household && hello.householdId === null) {
        const key = await ensureHouseholdKey(db);
        await this.send('p', {
          t: 'welcome',
          householdId: household.householdId,
          householdName: household.householdName,
          key: await exportHouseholdKey(key),
        });
        this.householdKey = key;
        this.householdId = household.householdId;
        this.householdReady.resolve();
      } else if (!household && hello.householdId !== null) {
        this.setState('joining');
        const welcome = await this.expect('welcome');
        const key = await importHouseholdKey(welcome.key);
        await joinHousehold(this.core, {
          householdId: welcome.householdId,
          householdName: welcome.householdName,
          householdKey: key,
          deviceName: this.options.deviceName,
        });
        this.householdKey = key;
        this.householdId = welcome.householdId;
        this.householdReady.resolve();
      } else if (!household) {
        throw new SyncError('no_household');
      } else if (household.householdId !== hello.householdId) {
        throw new SyncError('household_mismatch'); // one household per device (N2)
      } else {
        this.householdKey = await ensureHouseholdKey(db);
        this.householdId = household.householdId;
        this.householdReady.resolve();
      }

      this.setState('transferring');
      await this.sendSnapshot();
      await this.peerSnapshot.promise;
      this.setState('live');
      this.subscribeToOutbox();
    } catch (error) {
      this.fail(error);
      throw error instanceof SyncError ? error : new SyncError('protocol', String(error));
    }
  }

  close(): void {
    this.subscription?.unsubscribe();
    if (this.state !== 'failed') this.setState('closed');
    this.channel.close();
  }

  private setState(state: SessionState, error?: SyncError) {
    this.state = state;
    this.options.onState?.(state, error);
  }

  private fail(error: unknown) {
    if (this.state === 'closed' || this.state === 'failed') return;
    const e = error instanceof SyncError ? error : new SyncError('protocol', String(error));
    this.subscription?.unsubscribe();
    for (const w of this.waiting.values()) w.reject(e);
    this.waiting.clear();
    this.peerSnapshot.reject(e);
    this.householdReady.reject(e);
    this.setState(e.code === 'closed' && this.state === 'live' ? 'closed' : 'failed', e);
  }

  private async send(kind: 'p' | 'h', message: Plain): Promise<void> {
    const key = kind === 'p' ? this.pairingKey : this.householdKey;
    if (!key) throw new SyncError('protocol', 'no key for message');
    const aad = kind === 'p' ? 'pairing' : (this.householdId ?? '');
    const envelope: Envelope = { k: kind, d: await seal(key, message, aad) };
    this.channel.send(JSON.stringify(envelope));
  }

  private expect<T extends Plain['t']>(type: T): Promise<Extract<Plain, { t: T }>> {
    const early = this.early.get(type);
    if (early) {
      this.early.delete(type);
      return Promise.resolve(early as Extract<Plain, { t: T }>);
    }
    return new Promise((resolve, reject) => {
      this.waiting.set(type, { resolve: (m) => resolve(m as Extract<Plain, { t: T }>), reject });
    });
  }

  private async receive(raw: string): Promise<void> {
    const envelope: unknown = JSON.parse(raw);
    if (!isEnvelope(envelope)) throw new SyncError('protocol', 'bad envelope');
    let message: unknown;
    if (envelope.k === 'p') {
      message = await open(this.pairingKey, envelope.d, 'pairing');
    } else {
      // The host streams records right after `welcome`; wait until we stored the key.
      await this.householdReady.promise;
      if (!this.householdKey) throw new SyncError('protocol', 'no household key');
      message = await open(this.householdKey, envelope.d, this.householdId ?? '');
    }
    if (!isPlain(message)) throw new SyncError('protocol', 'bad message');

    if (message.t === 'records') {
      const applied = await applyRemoteRecords(this.core, message.items);
      if (applied > 0) this.options.onApplied?.(applied);
      if (message.last) {
        await this.send('h', { t: 'ack', upToSeq: message.upToSeq });
        if (message.initial) this.peerSnapshot.resolve();
      }
      return;
    }
    if (message.t === 'ack') {
      await acknowledge(this.core, message.upToSeq);
      return;
    }
    const waiter = this.waiting.get(message.t);
    if (waiter) {
      this.waiting.delete(message.t);
      waiter.resolve(message);
    } else {
      this.early.set(message.t, message);
    }
  }

  private async sendBatches(items: RemoteItem[], initial: boolean, upToSeq: number): Promise<void> {
    const batches = Math.max(1, Math.ceil(items.length / BATCH_SIZE));
    for (let i = 0; i < batches; i += 1) {
      await this.send('h', {
        t: 'records',
        items: items.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
        initial,
        last: i === batches - 1,
        upToSeq,
      });
    }
  }

  private async sendSnapshot(): Promise<void> {
    const { db } = this.core;
    // Read the outbox high-water mark first: everything up to it is in the snapshot.
    const upToSeq = (await db.outbox.orderBy('seq').last())?.seq ?? 0;
    const items = await snapshotRecords(this.core);
    await this.sendBatches(items, true, upToSeq);
    this.sentSeq = upToSeq;
  }

  /** Live phase: every new outbox row is sent as the record's current state. */
  private subscribeToOutbox(): void {
    const { db } = this.core;
    this.subscription = liveQuery(() =>
      db.outbox.where('seq').above(this.sentSeq).count(),
    ).subscribe({
      next: (pending) => {
        if (pending > 0)
          this.pumping = this.pumping.then(() => this.pump()).catch((e: unknown) => this.fail(e));
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  private async pump(): Promise<void> {
    if (this.state !== 'live') return;
    const { db } = this.core;
    const rows = await db.outbox.where('seq').above(this.sentSeq).toArray();
    if (rows.length === 0) return;
    const upToSeq = rows[rows.length - 1]?.seq ?? this.sentSeq;
    const seen = new Set<string>();
    const items: RemoteItem[] = [];
    for (const row of rows) {
      const key = `${row.entity}:${row.recordId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const record = (await db.tableFor(row.entity).get(row.recordId)) as Syncable | undefined;
      if (record) items.push({ e: row.entity, r: record });
    }
    await this.sendBatches(items, false, upToSeq);
    this.sentSeq = upToSeq;
  }
}
