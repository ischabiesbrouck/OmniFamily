import { describe, expect, it } from 'vitest';
import { compareHlc, formatHlc, HlcDriftError, HybridLogicalClock, parseHlc } from '@/lib/sync/hlc';

function strictlyIncreasing(values: string[]): boolean {
  return values.every((v, i) => i === 0 || compareHlc(values[i - 1] ?? '', v) < 0);
}

describe('HLC encoding', () => {
  it('round-trips and orders lexicographically', () => {
    const a = formatHlc({ pt: 1_000, c: 2, deviceId: 'dev-a' });
    expect(parseHlc(a)).toEqual({ pt: 1_000, c: 2, deviceId: 'dev-a' });
    expect(compareHlc(a, formatHlc({ pt: 1_000, c: 3, deviceId: 'dev-a' }))).toBeLessThan(0);
    expect(compareHlc(a, formatHlc({ pt: 999, c: 9, deviceId: 'dev-z' }))).toBeGreaterThan(0);
    // 0x100 > 0xff only works because of fixed-width padding
    expect(
      compareHlc(
        formatHlc({ pt: 0xff, c: 0, deviceId: 'x' }),
        formatHlc({ pt: 0x100, c: 0, deviceId: 'x' }),
      ),
    ).toBeLessThan(0);
  });

  it('breaks ties by deviceId', () => {
    const a = formatHlc({ pt: 5, c: 0, deviceId: 'aaa' });
    const b = formatHlc({ pt: 5, c: 0, deviceId: 'bbb' });
    expect(compareHlc(a, b)).toBeLessThan(0);
  });

  it('rejects malformed input', () => {
    expect(() => parseHlc('nonsense')).toThrow(SyntaxError);
    expect(() => formatHlc({ pt: -1, c: 0, deviceId: 'x' })).toThrow(RangeError);
    expect(() => new HybridLogicalClock('bad:id')).toThrow(RangeError);
  });
});

describe('HLC monotonicity under simulated clock skew', () => {
  it('stays strictly increasing when the wall clock jumps backwards', () => {
    let wall = 10_000;
    const clock = new HybridLogicalClock('dev-a', { now: () => wall });
    const stamps = [clock.send(), clock.send()];
    wall = 4_000; // NTP correction / manual change moves time back
    stamps.push(clock.send(), clock.send());
    wall = 10_000;
    stamps.push(clock.send());
    wall = 12_000;
    stamps.push(clock.send());
    expect(strictlyIncreasing(stamps)).toBe(true);
    expect(parseHlc(stamps[5] ?? '').pt).toBe(12_000);
  });

  it('orders causally across devices whose clocks are skewed by an hour', () => {
    const hour = 60 * 60 * 1000;
    let wall = 1_000_000_000;
    const fast = new HybridLogicalClock('dev-fast', { now: () => wall + hour });
    const slow = new HybridLogicalClock('dev-slow', { now: () => wall - hour });

    const editOnFast = fast.send();
    wall += 1; // the slow device edits *after* seeing the fast device's edit
    const received = slow.recv(editOnFast);
    const editOnSlow = slow.send();

    expect(compareHlc(editOnFast, received)).toBeLessThan(0);
    expect(compareHlc(editOnFast, editOnSlow)).toBeLessThan(0); // causal edit wins LWW
    // and the fast device, on receiving it, still moves forward
    const back = fast.recv(editOnSlow);
    expect(compareHlc(editOnSlow, back)).toBeLessThan(0);
  });

  it('stays monotonic across many interleaved sends and receives with random skew', () => {
    let wall = 50_000;
    let seed = 42;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const a = new HybridLogicalClock('a', { now: () => wall + Math.floor(rand() * 2_000) - 1_000 });
    const b = new HybridLogicalClock('b', { now: () => wall - 30_000 });
    const seenByA: string[] = [];
    for (let i = 0; i < 2_000; i += 1) {
      wall += Math.floor(rand() * 3) - 1; // jitter, sometimes backwards
      seenByA.push(rand() < 0.5 ? a.send() : a.recv(b.send()));
    }
    expect(strictlyIncreasing(seenByA)).toBe(true);
  });

  it('borrows the next millisecond when the 16-bit counter is exhausted', () => {
    const clock = new HybridLogicalClock('dev', { now: () => 7, state: { pt: 7, c: 0xffff } });
    const next = parseHlc(clock.send());
    expect(next).toMatchObject({ pt: 8, c: 0 });
  });

  it('rejects remote timestamps beyond the drift bound', () => {
    const clock = new HybridLogicalClock('dev', { now: () => 0, maxDriftMs: 1_000 });
    const farFuture = formatHlc({ pt: 5_000, c: 0, deviceId: 'other' });
    expect(() => clock.recv(farFuture)).toThrow(HlcDriftError);
  });

  it('never moves backwards when observing older persisted state', () => {
    const clock = new HybridLogicalClock('dev', { now: () => 0, state: { pt: 100, c: 5 } });
    clock.observe({ pt: 50, c: 9 });
    expect(clock.snapshot()).toEqual({ pt: 100, c: 5 });
    clock.observe({ pt: 100, c: 7 });
    expect(clock.snapshot()).toEqual({ pt: 100, c: 7 });
  });
});
