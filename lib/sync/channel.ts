/** A reliable, ordered, text message pipe: an RTCDataChannel in the app, memory in tests. */
export interface SyncChannel {
  send(message: string): void;
  /** Messages received before a handler is attached are buffered, never lost. */
  setHandlers(onMessage: (message: string) => void, onClose: () => void): void;
  close(): void;
}

class BufferedChannel implements SyncChannel {
  private buffer: string[] = [];
  private onMessage: ((m: string) => void) | null = null;
  private onClose: (() => void) | null = null;
  private closed = false;

  constructor(
    private readonly transmit: (m: string) => void,
    private readonly shutdown: () => void,
  ) {}

  deliver(message: string) {
    if (this.closed) return;
    if (this.onMessage) this.onMessage(message);
    else this.buffer.push(message);
  }

  end() {
    if (this.closed) return;
    this.closed = true;
    this.onClose?.();
  }

  send(message: string) {
    if (this.closed) throw new Error('Channel closed');
    this.transmit(message);
  }

  setHandlers(onMessage: (m: string) => void, onClose: () => void) {
    this.onMessage = onMessage;
    this.onClose = onClose;
    for (const m of this.buffer.splice(0)) onMessage(m);
    if (this.closed) onClose();
  }

  close() {
    this.shutdown();
    this.end();
  }
}

/** Two connected in-memory ends. `dropAfter` cuts the link after N messages (partial-transfer tests). */
export function memoryChannelPair(
  options: { dropAfter?: number } = {},
): [SyncChannel, SyncChannel] {
  let sent = 0;
  // `a` and `b` are only touched inside callbacks that run after both exist.
  const cut = () => {
    setTimeout(() => {
      a.end();
      b.end();
    });
  };
  const via = (target: () => BufferedChannel) => (m: string) => {
    sent += 1;
    if (options.dropAfter !== undefined && sent > options.dropAfter) {
      cut();
      return;
    }
    setTimeout(() => target().deliver(m));
  };
  const a: BufferedChannel = new BufferedChannel(
    via(() => b),
    cut,
  );
  const b: BufferedChannel = new BufferedChannel(
    via(() => a),
    cut,
  );
  return [a, b];
}

export function fromDataChannel(dc: RTCDataChannel): SyncChannel {
  const channel = new BufferedChannel(
    (m) => dc.send(m),
    () => dc.close(),
  );
  dc.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (typeof event.data === 'string') channel.deliver(event.data);
  });
  dc.addEventListener('close', () => channel.end());
  return channel;
}
