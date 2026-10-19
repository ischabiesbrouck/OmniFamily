/**
 * Hybrid Logical Clock (Kulkarni et al., 2014) — the LWW ordering key (SPEC D4, §5.2).
 *
 * Serialised as `<48-bit physical ms>:<16-bit counter>:<deviceId>` with both numeric parts
 * zero-padded hex, so plain string comparison orders timestamps correctly and ties fall
 * through to the deviceId.
 */

const PT_HEX_WIDTH = 12; // 48 bits
const COUNTER_HEX_WIDTH = 4; // 16 bits
const MAX_PT = 2 ** 48 - 1;
const MAX_COUNTER = 2 ** 16 - 1;

/** Remote clocks further ahead than this are rejected instead of dragging ours forward. */
export const DEFAULT_MAX_DRIFT_MS = 24 * 60 * 60 * 1000;

export interface HlcTimestamp {
  pt: number;
  c: number;
  deviceId: string;
}

export interface HlcState {
  pt: number;
  c: number;
}

export class HlcDriftError extends Error {
  constructor(remotePt: number, localPt: number) {
    super(`Remote HLC ${remotePt} is too far ahead of local physical time ${localPt}`);
    this.name = 'HlcDriftError';
  }
}

export function formatHlc({ pt, c, deviceId }: HlcTimestamp): string {
  if (!Number.isInteger(pt) || pt < 0 || pt > MAX_PT) throw new RangeError(`Invalid HLC pt ${pt}`);
  if (!Number.isInteger(c) || c < 0 || c > MAX_COUNTER) throw new RangeError(`Invalid HLC c ${c}`);
  if (deviceId.length === 0) throw new RangeError('HLC deviceId must not be empty');
  return `${pt.toString(16).padStart(PT_HEX_WIDTH, '0')}:${c
    .toString(16)
    .padStart(COUNTER_HEX_WIDTH, '0')}:${deviceId}`;
}

export function parseHlc(value: string): HlcTimestamp {
  const first = value.indexOf(':');
  const second = value.indexOf(':', first + 1);
  if (first !== PT_HEX_WIDTH || second !== PT_HEX_WIDTH + COUNTER_HEX_WIDTH + 1) {
    throw new SyntaxError(`Malformed HLC "${value}"`);
  }
  const pt = Number.parseInt(value.slice(0, first), 16);
  const c = Number.parseInt(value.slice(first + 1, second), 16);
  const deviceId = value.slice(second + 1);
  if (Number.isNaN(pt) || Number.isNaN(c) || deviceId.length === 0) {
    throw new SyntaxError(`Malformed HLC "${value}"`);
  }
  return { pt, c, deviceId };
}

/** Negative when `a` happened before `b`. Fixed-width encoding makes this a string compare. */
export function compareHlc(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export interface HlcOptions {
  now?: () => number;
  maxDriftMs?: number;
  state?: HlcState;
}

export class HybridLogicalClock {
  readonly deviceId: string;
  private readonly now: () => number;
  private readonly maxDriftMs: number;
  private pt: number;
  private c: number;

  constructor(deviceId: string, options: HlcOptions = {}) {
    if (deviceId.length === 0 || deviceId.includes(':')) {
      throw new RangeError('deviceId must be non-empty and must not contain ":"');
    }
    this.deviceId = deviceId;
    this.now = options.now ?? Date.now;
    this.maxDriftMs = options.maxDriftMs ?? DEFAULT_MAX_DRIFT_MS;
    this.pt = options.state?.pt ?? 0;
    this.c = options.state?.c ?? 0;
  }

  snapshot(): HlcState {
    return { pt: this.pt, c: this.c };
  }

  /** Fold in persisted state (e.g. written by another tab) without moving backwards. */
  observe(state: HlcState): void {
    if (state.pt > this.pt || (state.pt === this.pt && state.c > this.c)) {
      this.pt = state.pt;
      this.c = state.c;
    }
  }

  /** Timestamp for a local mutation. */
  send(): string {
    const physical = this.now();
    if (physical > this.pt) {
      this.pt = physical;
      this.c = 0;
    } else {
      this.increment();
    }
    return this.current();
  }

  /** Advance past a remote timestamp that is being applied locally. */
  recv(remote: string): string {
    const r = parseHlc(remote);
    const physical = this.now();
    if (r.pt - physical > this.maxDriftMs) throw new HlcDriftError(r.pt, physical);

    const maxPt = Math.max(this.pt, r.pt, physical);
    if (maxPt === this.pt && maxPt === r.pt) {
      this.c = Math.max(this.c, r.c);
      this.increment();
    } else if (maxPt === this.pt) {
      this.increment();
    } else if (maxPt === r.pt) {
      this.pt = r.pt;
      this.c = r.c;
      this.increment();
    } else {
      this.pt = physical;
      this.c = 0;
    }
    return this.current();
  }

  private increment(): void {
    if (this.c === MAX_COUNTER) {
      // Counter exhausted within one millisecond: borrow the next millisecond to stay monotonic.
      this.pt += 1;
      this.c = 0;
    } else {
      this.c += 1;
    }
  }

  private current(): string {
    return formatHlc({ pt: this.pt, c: this.c, deviceId: this.deviceId });
  }
}
