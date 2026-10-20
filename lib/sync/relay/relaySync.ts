import { liveQuery, type Subscription } from 'dexie';
import type { RepositoryCore } from '@/lib/db/repositories/core';
import { ensureHouseholdKey, getHousehold } from '@/lib/db/repositories/household';
import { acknowledge, applyRemoteRecords, snapshotRecords } from '../apply';
import { RELAY_STATE_KEY } from './config';
import { householdSigningKeys, type SigningKeys } from './keys';
import { APP_DATA_KIND, signEvent, tagValue, toHex, type NostrEvent } from './nostr';
import { RelayPool, type SocketFactory } from './pool';
import { ChunkAssembler, decodeSnapshot, encodeSnapshot, parseChunk } from './snapshot';

export type RelayState = 'connecting' | 'online' | 'offline';

export interface RelaySyncOptions {
  relays: readonly string[];
  socketFactory?: SocketFactory;
  /** Wait this long after a change before publishing, so quick edits go out together. */
  debounceMs?: number;
  /** Republish an unchanged snapshot after this long, in case relays dropped it. */
  refreshMs?: number;
  /** Retry delay when no relay accepted a publish. */
  retryMs?: number;
  onState?: (state: RelayState) => void;
  /** A snapshot was published or another device's snapshot was merged. */
  onSynced?: (at: number) => void;
  onApplied?: (count: number) => void;
}

interface PublishedState {
  hash: string;
  at: number;
  createdAt: number;
}

function isPublishedState(v: unknown): v is PublishedState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.hash === 'string' && typeof s.at === 'number' && typeof s.createdAt === 'number';
}

const D_TAG = /^of:([^:]+):(\d+)$/;

/**
 * Internet sync without a server of our own (D-10.1). Every device publishes its whole state,
 * encrypted, as replaceable events on a few public relays and merges the other devices'
 * latest snapshots with the same LWW rules as LAN sync. Devices need not be online together,
 * and publishing the full state keeps it idempotent: replays and partial uploads are harmless.
 */
export class RelaySync {
  private pool: RelayPool | undefined;
  private keys: SigningKeys | undefined;
  private householdKey: CryptoKey | undefined;
  private householdId = '';
  private deviceId = '';
  private readonly assembler = new ChunkAssembler();
  private readonly seen = new Set<string>();
  private work: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refresher: ReturnType<typeof setInterval> | undefined;
  private outbox: Subscription | undefined;
  private unsubscribe: (() => void) | undefined;
  private published: PublishedState | undefined;
  private stopped = false;
  private readonly onOnline = () => {
    this.pool?.wake();
    this.schedule(0);
  };

  constructor(
    private readonly core: RepositoryCore,
    private readonly options: RelaySyncOptions,
  ) {}

  private get debounceMs() {
    return this.options.debounceMs ?? 1_500;
  }

  private get refreshMs() {
    return this.options.refreshMs ?? 12 * 60 * 60 * 1_000;
  }

  async start(): Promise<void> {
    const { db } = this.core;
    const household = await getHousehold(db);
    if (!household) throw new Error('No household on this device');
    this.householdId = household.householdId;
    this.deviceId = household.deviceId;
    this.householdKey = await ensureHouseholdKey(db);
    this.keys = await householdSigningKeys(this.householdKey);
    const stored = (await db.settings.get(RELAY_STATE_KEY))?.value;
    this.published = isPublishedState(stored) ? stored : undefined;
    if (this.stopped) return;

    const pool = new RelayPool(this.options.relays, this.options.socketFactory);
    this.pool = pool;
    this.options.onState?.('connecting');
    pool.onStatus((connected) => {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      this.options.onState?.(connected > 0 ? 'online' : offline ? 'offline' : 'connecting');
    });
    this.unsubscribe = pool.subscribe(
      [{ kinds: [APP_DATA_KIND], authors: [this.keys.pubkey] }],
      (event) => this.enqueue(() => this.receive(event)),
    );
    this.outbox = liveQuery(() => db.outbox.count()).subscribe({
      next: (pending) => {
        if (pending > 0) this.schedule(this.debounceMs);
      },
      error: () => {},
    });
    this.refresher = setInterval(() => this.schedule(0), Math.min(this.refreshMs, 60 * 60 * 1_000));
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
    this.schedule(0);
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.refresher);
    this.outbox?.unsubscribe();
    this.unsubscribe?.();
    this.pool?.close();
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
  }

  /** Publish now (if anything changed); resolves when done. Used by tests and "Sync now". */
  flush(): Promise<void> {
    clearTimeout(this.timer);
    return this.enqueue(() => this.publish());
  }

  /** Resolves once everything queued so far (received snapshots, publishes) is processed. */
  idle(): Promise<void> {
    return this.enqueue(async () => {});
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    this.work = this.work.then(job).catch(() => {});
    return this.work;
  }

  private schedule(delay: number) {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.enqueue(() => this.publish()), delay);
  }

  private async receive(event: NostrEvent): Promise<void> {
    if (this.stopped || this.seen.has(event.id) || !this.householdKey) return;
    this.seen.add(event.id);
    const d = D_TAG.exec(tagValue(event, 'd') ?? '');
    const deviceId = d?.[1];
    if (!deviceId || deviceId === this.deviceId) return;
    const chunk = parseChunk(event.content);
    if (!chunk) return;
    const parts = this.assembler.add(deviceId, chunk);
    if (!parts) return;

    let items: unknown;
    try {
      items = await decodeSnapshot(this.householdKey, this.householdId, parts);
    } catch {
      return; // not sealed with our key, or tampered with
    }
    if (!Array.isArray(items)) return;
    const applied = await applyRemoteRecords(this.core, items);
    if (applied > 0) {
      this.options.onApplied?.(applied);
      // Our snapshot now holds merged data other devices may still lack.
      this.schedule(this.debounceMs);
    }
    this.options.onSynced?.(Date.now());
  }

  private async publish(): Promise<void> {
    const { pool, keys, householdKey } = this;
    if (this.stopped || !pool || !keys || !householdKey) return;
    const { db } = this.core;
    // Everything up to this outbox row is in the snapshot read below.
    const upToSeq = (await db.outbox.orderBy('seq').last())?.seq ?? 0;
    const items = (await snapshotRecords(this.core)).map(({ e, r }) => {
      const { syncStatus: _local, ...record } = r;
      return { e, r: record };
    });
    const json = JSON.stringify(items);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    const hash = toHex(new Uint8Array(digest));
    const now = Date.now();

    if (this.published?.hash === hash && now - this.published.at < this.refreshMs) {
      if (upToSeq > 0) await acknowledge(this.core, upToSeq);
      return;
    }

    const chunks = await encodeSnapshot(householdKey, this.householdId, items);
    // Relays keep the newest event per address, so timestamps must only ever go up.
    const createdAt = Math.max(Math.floor(now / 1_000), (this.published?.createdAt ?? 0) + 1);
    const events = await Promise.all(
      chunks.map((chunk) =>
        signEvent(
          {
            created_at: createdAt,
            kind: APP_DATA_KIND,
            tags: [['d', `of:${this.deviceId}:${chunk.i}`]],
            content: JSON.stringify(chunk),
          },
          keys.secretKey,
        ),
      ),
    );
    const stored = await Promise.all(events.map((event) => pool.publish(event)));
    if (this.stopped) return;
    if (stored.some((count) => count === 0)) {
      this.schedule(this.options.retryMs ?? 30_000);
      return;
    }
    if (upToSeq > 0) await acknowledge(this.core, upToSeq);
    this.published = { hash, at: now, createdAt };
    await db.settings.put({ key: RELAY_STATE_KEY, value: this.published });
    this.options.onSynced?.(now);
  }
}
