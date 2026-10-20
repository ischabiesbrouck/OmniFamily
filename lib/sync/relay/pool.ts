import { isNostrEvent, type NostrEvent, type NostrFilter } from './nostr';

/** The part of `WebSocket` the pool uses; tests pass an in-memory relay. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}
export type SocketFactory = (url: string) => SocketLike;

const OPEN = 1;
const MAX_BACKOFF_MS = 60_000;
/** Messages held for a relay that is down; older ones are superseded snapshots anyway. */
const MAX_QUEUED = 50;

interface Subscription {
  id: string;
  filters: NostrFilter[];
  onEvent: (event: NostrEvent) => void;
  onEose: (() => void) | undefined;
  eosed: Set<string>;
}

interface PendingPublish {
  ok: Set<string>;
  answered: Set<string>;
  done: () => void;
}

class RelayConnection {
  socket: SocketLike | null = null;
  private queue: string[] = [];
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    readonly url: string,
    private readonly factory: SocketFactory,
    private readonly onOpen: (relay: RelayConnection) => void,
    private readonly onMessage: (relay: RelayConnection, data: unknown[]) => void,
    private readonly onChange: () => void,
  ) {}

  get open(): boolean {
    return this.socket?.readyState === OPEN;
  }

  connect(): void {
    if (this.closed || this.socket) return;
    let socket: SocketLike;
    try {
      socket = this.factory(this.url);
    } catch {
      this.retry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      for (const m of this.queue.splice(0)) socket.send(m);
      this.onOpen(this);
      this.onChange();
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const data: unknown = JSON.parse(event.data);
        if (Array.isArray(data)) this.onMessage(this, data);
      } catch {
        // A relay that sends garbage is ignored, not trusted.
      }
    };
    socket.onclose = () => {
      this.socket = null;
      this.onChange();
      this.retry();
    };
    socket.onerror = () => socket.close();
  }

  /** Sends now when open; otherwise on the next successful connect. */
  send(message: string): void {
    if (this.open) this.socket?.send(message);
    else {
      this.queue.push(message);
      if (this.queue.length > MAX_QUEUED) this.queue.shift();
      this.connect();
    }
  }

  /** Reconnect now instead of waiting out the backoff (e.g. the browser came back online). */
  wake(): void {
    if (this.closed || this.socket) return;
    clearTimeout(this.timer);
    this.attempts = 0;
    this.connect();
  }

  private retry() {
    if (this.closed) return;
    clearTimeout(this.timer);
    const delay = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** this.attempts);
    this.attempts += 1;
    this.timer = setTimeout(() => this.connect(), delay);
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  }
}

/**
 * A handful of public relays used as a dumb, redundant mailbox (D-10.1): every event goes to
 * all of them, every subscription asks all of them, and reconnects back off exponentially.
 */
export class RelayPool {
  private readonly relays: RelayConnection[];
  private readonly subs = new Map<string, Subscription>();
  private readonly pending = new Map<string, PendingPublish>();
  private statusListener: ((connected: number) => void) | undefined;
  private counter = 0;

  constructor(
    urls: readonly string[],
    factory: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike,
  ) {
    this.relays = urls.map(
      (url) =>
        new RelayConnection(
          url,
          factory,
          (relay) => this.resubscribe(relay),
          (relay, data) => this.receive(relay, data),
          () => this.statusListener?.(this.connected),
        ),
    );
  }

  get size(): number {
    return this.relays.length;
  }

  get connected(): number {
    return this.relays.filter((r) => r.open).length;
  }

  onStatus(listener: (connected: number) => void): void {
    this.statusListener = listener;
  }

  wake(): void {
    for (const relay of this.relays) relay.wake();
  }

  subscribe(
    filters: NostrFilter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void,
  ): () => void {
    this.counter += 1;
    const id = `of${this.counter}`;
    const sub: Subscription = { id, filters, onEvent, onEose, eosed: new Set() };
    this.subs.set(id, sub);
    // Closed relays get every live subscription when they (re)connect (`resubscribe`).
    const req = JSON.stringify(['REQ', id, ...filters]);
    for (const relay of this.relays) {
      if (relay.open) relay.send(req);
      else relay.connect();
    }
    return () => {
      this.subs.delete(id);
      for (const relay of this.relays) if (relay.open) relay.send(JSON.stringify(['CLOSE', id]));
    };
  }

  /** Resolves with the number of relays that stored the event (0 when none answered in time). */
  publish(event: NostrEvent, timeoutMs = 10_000): Promise<number> {
    return new Promise((resolve) => {
      const entry: PendingPublish = {
        ok: new Set(),
        answered: new Set(),
        done: () => {
          clearTimeout(timer);
          this.pending.delete(event.id);
          resolve(entry.ok.size);
        },
      };
      const timer = setTimeout(entry.done, timeoutMs);
      this.pending.set(event.id, entry);
      const message = JSON.stringify(['EVENT', event]);
      for (const relay of this.relays) relay.send(message);
    });
  }

  close(): void {
    for (const relay of this.relays) relay.close();
    for (const entry of [...this.pending.values()]) entry.done();
    this.subs.clear();
  }

  private resubscribe(relay: RelayConnection) {
    for (const sub of this.subs.values())
      relay.send(JSON.stringify(['REQ', sub.id, ...sub.filters]));
  }

  private receive(relay: RelayConnection, data: unknown[]) {
    const [type, a, b] = data;
    if (type === 'EVENT' && typeof a === 'string') {
      const sub = this.subs.get(a);
      if (sub && isNostrEvent(b)) sub.onEvent(b);
    } else if (type === 'EOSE' && typeof a === 'string') {
      const sub = this.subs.get(a);
      if (!sub) return;
      sub.eosed.add(relay.url);
      if (sub.eosed.size === this.relays.length) sub.onEose?.();
    } else if (type === 'OK' && typeof a === 'string') {
      const entry = this.pending.get(a);
      if (!entry) return;
      entry.answered.add(relay.url);
      if (b === true) entry.ok.add(relay.url);
      if (entry.answered.size === this.relays.length) entry.done();
    }
  }
}
