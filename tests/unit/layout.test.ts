import { describe, expect, it } from 'vitest';
import { layoutDay } from '@/lib/calendar/layout';

const at = (h: number, m = 0) => h * 60 + m;
const item = (id: string, start: number, end: number) => ({ id, startMin: start, endMin: end });
const summary = (placed: ReturnType<typeof layoutDay<ReturnType<typeof item>>>) =>
  Object.fromEntries(placed.map((p) => [p.item.id, [p.column, p.columns, p.top, p.height]]));

describe('time-grid layout', () => {
  it('gives non-overlapping events the full width', () => {
    expect(summary(layoutDay([item('a', at(9), at(10)), item('b', at(10), at(11))]))).toEqual({
      a: [0, 1, 540, 60],
      b: [0, 1, 600, 60],
    });
  });

  it('puts overlapping events side by side and reuses freed columns', () => {
    const placed = summary(
      layoutDay([
        item('a', at(9), at(11)),
        item('b', at(9, 30), at(10)),
        item('c', at(10), at(10, 30)),
        item('d', at(12), at(13)),
      ]),
    );
    expect(placed.a).toEqual([0, 2, 540, 120]);
    expect(placed.b).toEqual([1, 2, 570, 30]);
    expect(placed.c).toEqual([1, 2, 600, 30]); // reuses b's column
    expect(placed.d).toEqual([0, 1, 720, 60]); // new cluster
  });

  it('enforces a minimum height and clips to the day', () => {
    const placed = summary(
      layoutDay([
        item('zero', at(8), at(8)),
        item('late', at(23, 50), at(26)),
        item('early', -30, at(1)),
      ]),
    );
    expect(placed.zero).toEqual([0, 1, 480, 20]);
    expect(placed.late?.[2]).toBe(1420);
    expect(placed.late?.[3]).toBe(20);
    expect(placed.early).toEqual([0, 1, 0, 60]);
  });
});
