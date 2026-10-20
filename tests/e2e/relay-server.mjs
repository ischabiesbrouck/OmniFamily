// A minimal NIP-01 relay for the e2e tests (D-10.1): stores events in memory, replaces
// addressable ones (kinds 30000–39999) by newer ones and fans new events out to subscribers.
import { WebSocketServer } from 'ws';

const port = Number(process.argv[2] ?? 7777);
const stored = new Map();
const wss = new WebSocketServer({ port, maxPayload: 512 * 1024 });

const matches = (f, e) =>
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (f.since === undefined || e.created_at >= f.since);

const address = (e) =>
  e.kind >= 30000 && e.kind < 40000
    ? `${e.kind}:${e.pubkey}:${e.tags.find((t) => t[0] === 'd')?.[1] ?? ''}`
    : e.id;

wss.on('connection', (ws) => {
  ws.subs = new Map();
  const send = (m) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(m));
  };
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const [type, a, ...rest] = msg;
    if (type === 'REQ') {
      ws.subs.set(a, rest);
      for (const e of stored.values()) if (rest.some((f) => matches(f, e))) send(['EVENT', a, e]);
      send(['EOSE', a]);
    } else if (type === 'CLOSE') {
      ws.subs.delete(a);
    } else if (type === 'EVENT') {
      const current = stored.get(address(a));
      if (!current || current.created_at <= a.created_at) stored.set(address(a), a);
      send(['OK', a.id, true, '']);
      for (const client of wss.clients)
        for (const [id, filters] of client.subs ?? [])
          if (client.readyState === 1 && filters.some((f) => matches(f, a)))
            client.send(JSON.stringify(['EVENT', id, a]));
    }
  });
});
