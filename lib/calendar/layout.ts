/**
 * Time-grid layout for day and week views. Positions are in wall-clock minutes of the
 * viewed day (0–1440), so hour labels always line up, DST days included.
 */
export const DAY_MINUTES = 24 * 60;

export interface TimedItem {
  /** wall-clock minute the item starts on this day (0 if it began earlier) */
  startMin: number;
  /** wall-clock minute it ends on this day (1440 if it runs past midnight) */
  endMin: number;
}

export interface Placed<T> {
  item: T;
  top: number;
  height: number;
  column: number;
  columns: number;
}

/**
 * Packs overlapping items into side-by-side columns: items are grouped into clusters that
 * overlap transitively, and each takes the first free column of its cluster.
 */
export function layoutDay<T extends TimedItem>(items: readonly T[], minHeight = 20): Placed<T>[] {
  const sorted = items
    .map((item) => {
      const top = Math.max(0, Math.min(DAY_MINUTES - minHeight, item.startMin));
      const bottom = Math.min(DAY_MINUTES, Math.max(top + minHeight, item.endMin));
      return { item, top, bottom };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const placed: Placed<T>[] = [];
  let cluster: Array<{ item: T; top: number; bottom: number; column: number }> = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const c of cluster) {
      placed.push({
        item: c.item,
        top: c.top,
        height: c.bottom - c.top,
        column: c.column,
        columns: columnEnds.length,
      });
    }
    cluster = [];
    columnEnds = [];
  };

  for (const entry of sorted) {
    if (entry.top >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= entry.top);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(entry.bottom);
    } else {
      columnEnds[column] = entry.bottom;
    }
    cluster.push({ ...entry, column });
    clusterEnd = Math.max(clusterEnd, entry.bottom);
  }
  flush();
  return placed;
}
