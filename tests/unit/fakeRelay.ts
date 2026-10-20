import type { NostrEvent, NostrFilter } from '@/lib/sync/relay/nostr';
import type { SocketLike } from '@/lib/sync/relay/pool';

function matches(filter: NostrFilter, e: NostrEvent): boolean {
  if (filter.kinds && !filter.kinds.includes(e.kind)) return false;
  if (filter.authors && !filter.authors.includes(e.pubkey)) return false;
  if (filter.since !== undefined && e.created_at < filter.since) return false;
  return true;
}

function address(e: NostrEvent): string {
  if (e.kind >= 30_000 && e.kind < 40_000) {
    const d = e.tags.find((t) => t[0] === 'd')?.[1] ?? '';
    return `${e.kind}:${e.pubkey}:${d}`;
  }
  return e.id;
}

class FakeSocket implements SocketLike {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  subs = new Map<string, NostrFilter[]>();

  constructor(private readonly relay: FakeRelay) {
    setTimeout(() => {
      if (relay.down) {
        this.readyState = 3;
        this.onclose?.();
        return;
      }
      this.readyState = 1;
      relay.clients.add(this);
      this.onopen?.();
    });
  }

  send(data: string) {
    if (this.readyState !== 1) throw new Error('not open');
    setTimeout(() => this.relay.handle(this, data));
  }

  deliver(message: unknown[]) {
    if (this.readyState === 1) this.onmessage?.({ data: JSON.stringify(message) });
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.relay.clients.delete(this);
    setTimeout(() => this.onclose?.());
  }
}

/** An in-memory NIP-01 relay: stores events (replacing addressable ones) and fans them out. */
export class FakeRelay {
  readonly stored = new Map<string, NostrEvent>();
  readonly clients = new Set<FakeSocket>();
  accept = true;
  down = false;

  socket = (): SocketLike => new FakeSocket(this);

  get events(): NostrEvent[] {
    return [...this.stored.values()];
  }

  /** Drops every connection, as a relay restart would. */
  disconnectAll() {
    for (const c of [...this.clients]) c.close();
  }

  handle(client: FakeSocket, raw: string) {
    const [type, a, ...rest] = JSON.parse(raw) as [string, unknown, ...unknown[]];
    if (type === 'REQ' && typeof a === 'string') {
      const filters = rest as NostrFilter[];
      client.subs.set(a, filters);
      for (const e of this.stored.values())
        if (filters.some((f) => matches(f, e))) client.deliver(['EVENT', a, e]);
      client.deliver(['EOSE', a]);
    } else if (type === 'CLOSE' && typeof a === 'string') {
      client.subs.delete(a);
    } else if (type === 'EVENT') {
      const e = a as NostrEvent;
      if (!this.accept) {
        client.deliver(['OK', e.id, false, 'blocked: test']);
        return;
      }
      const key = address(e);
      const current = this.stored.get(key);
      if (current && current.created_at > e.created_at) {
        client.deliver(['OK', e.id, true, 'duplicate: have newer']);
        return;
      }
      this.stored.set(key, e);
      client.deliver(['OK', e.id, true, '']);
      for (const c of this.clients)
        for (const [id, filters] of c.subs)
          if (filters.some((f) => matches(f, e))) c.deliver(['EVENT', id, e]);
    }
  }
}
