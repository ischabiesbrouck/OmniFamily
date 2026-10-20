import {
  formatFloatingDate,
  formatWallTime,
  parseFloatingDate,
  type FloatingDate,
  type WallTime,
} from '@/lib/time/zoned';
import { extractFromText } from './text';
import type { Candidate, ExtractOptions } from './types';

/** A spreadsheet cell as the readers deliver it. */
export type Cell = string | number | boolean | Date | null | undefined;

type Column = 'date' | 'start' | 'end' | 'title' | 'location' | 'who';

/** Header words (en + nl) → column meaning. Checked in this order, first match wins. */
const HEADERS: ReadonlyArray<[Column, RegExp]> = [
  ['end', /^(end|ends|end time|until|to|eind|eindtijd|einde|tot)$/i],
  ['start', /^(time|start|starts|start time|begin|from|tijd|aanvang|van|begintijd|starttijd)$/i],
  ['date', /^(date|day|when|datum|dag|wanneer)$/i],
  [
    'title',
    /^(title|what|activity|event|subject|description|name|titel|wat|activiteit|afspraak|onderwerp|omschrijving|naam)$/i,
  ],
  ['location', /^(location|place|where|venue|locatie|plaats|waar)$/i],
  ['who', /^(who|people|person|for|wie|voor|persoon|personen)$/i],
];

const pad = (n: number) => String(n).padStart(2, '0');

function text(cell: Cell): string {
  if (cell instanceof Date) return cell.toISOString();
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

/** Excel serial day number (1900 system) → floating date. */
function fromSerial(serial: number): FloatingDate {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
  return formatFloatingDate({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

export function parseDateCell(cell: Cell, locale: string): FloatingDate | undefined {
  // Spreadsheet dates arrive as UTC midnight (xlsx) — read their UTC calendar day.
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return formatFloatingDate({
      year: cell.getUTCFullYear(),
      month: cell.getUTCMonth() + 1,
      day: cell.getUTCDate(),
    });
  }
  if (typeof cell === 'number' && cell > 20_000 && cell < 80_000) return fromSerial(cell);
  const s = text(cell);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return safeDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    const [a, b] = [Number(m[1]), Number(m[2])];
    // Day first everywhere except US English.
    return /^en-US\b/i.test(locale) ? safeDate(year, a, b) : safeDate(year, b, a);
  }
  return undefined;
}

function safeDate(year: number, month: number, day: number): FloatingDate | undefined {
  try {
    const date = formatFloatingDate({ year, month, day });
    parseFloatingDate(date);
    return date;
  } catch {
    return undefined;
  }
}

/** "19:00", "19.00", "7pm", "7:30 PM", an Excel time fraction, or a time-of-day Date. */
export function parseTimeCell(cell: Cell): WallTime | undefined {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return formatWallTime({ hour: cell.getUTCHours(), minute: cell.getUTCMinutes() });
  }
  if (typeof cell === 'number' && cell >= 0 && cell < 1) {
    const minutes = Math.round(cell * 24 * 60);
    return formatWallTime({ hour: Math.floor(minutes / 60) % 24, minute: minutes % 60 });
  }
  const m = /^(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|u|uur)?$/i.exec(text(cell));
  if (!m) return undefined;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]?.toLowerCase().replace(/\./g, '');
  if (!m[2] && !meridiem) return undefined; // a bare "7" is not a time
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return undefined;
  return `${pad(hour)}:${pad(minute)}`;
}

function parseRange(cell: Cell): [WallTime, WallTime] | undefined {
  const parts = text(cell).split(/\s*(?:-|–|—|tot|to|until)\s*/i);
  if (parts.length !== 2) return undefined;
  const [a, b] = parts.map((p) => parseTimeCell(p));
  return a && b ? [a, b] : undefined;
}

function detectHeader(
  rows: readonly Cell[][],
): { index: number; columns: Map<Column, number> } | undefined {
  for (let index = 0; index < Math.min(rows.length, 5); index += 1) {
    const columns = new Map<Column, number>();
    (rows[index] ?? []).forEach((cell, col) => {
      const label = text(cell).replace(/[:*]$/, '');
      const match = HEADERS.find(([, re]) => re.test(label));
      if (match && !columns.has(match[0])) columns.set(match[0], col);
    });
    if (columns.has('date')) return { index, columns };
  }
  return undefined;
}

function membersIn(value: string, members: ExtractOptions['members']): string[] {
  const lower = value.toLocaleLowerCase();
  return members
    .filter((m) => m.name.trim() && lower.includes(m.name.trim().toLocaleLowerCase()))
    .map((m) => m.id);
}

/**
 * Spreadsheet rows → candidates. With a recognisable header row (Date/Datum, Time/Tijd,
 * What/Wat, …) columns are mapped directly; otherwise each row is read as a line of text.
 */
export function rowsToCandidates(rows: readonly Cell[][], options: ExtractOptions): Candidate[] {
  const header = detectHeader(rows);
  if (!header) {
    const lines = rows.map((row) => row.map(text).filter(Boolean).join(' ')).join('\n');
    return extractFromText(lines, options);
  }

  const col = (row: readonly Cell[], c: Column) => {
    const i = header.columns.get(c);
    return i === undefined ? undefined : row[i];
  };
  const candidates: Candidate[] = [];
  rows.slice(header.index + 1).forEach((row, i) => {
    const dateCell = col(row, 'date');
    const date = parseDateCell(dateCell ?? null, options.locale);
    if (!date) return;
    const range = parseRange(col(row, 'start') ?? null);
    const startTime =
      range?.[0] ??
      parseTimeCell(col(row, 'start') ?? null) ??
      (dateCell instanceof Date && (dateCell.getUTCHours() || dateCell.getUTCMinutes())
        ? parseTimeCell(dateCell)
        : undefined);
    const endTime = range?.[1] ?? parseTimeCell(col(row, 'end') ?? null);
    const used = new Set([...header.columns.values()]);
    const title =
      text(col(row, 'title') ?? null) ||
      row
        .filter((_, c) => !used.has(c))
        .map(text)
        .filter(Boolean)
        .join(' ') ||
      options.fallbackTitle;
    const location = text(col(row, 'location') ?? null);
    const who = text(col(row, 'who') ?? null);
    candidates.push({
      key: `row${header.index + 1 + i}`,
      title,
      date,
      ...(startTime ? { startTime } : {}),
      ...(startTime && endTime && endTime > startTime ? { endTime } : {}),
      ...(location ? { location } : {}),
      memberIds: membersIn(`${who} ${title}`, options.members),
      source: row.map(text).filter(Boolean).join(' · '),
    });
  });
  return candidates;
}

export class UnsupportedFileError extends Error {
  constructor(readonly extension: string) {
    super(`Unsupported file type: .${extension}`);
    this.name = 'UnsupportedFileError';
  }
}

export const SPREADSHEET_ACCEPT = '.xlsx,.ods,.csv,.tsv,.txt';

/** OpenDocument spreadsheet (.ods): content.xml, first table, typed cell values. */
export async function readOds(data: ArrayBuffer): Promise<Cell[][]> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(data), { filter: (f) => f.name === 'content.xml' });
  const xml = files['content.xml'];
  if (!xml) throw new Error('Not an OpenDocument spreadsheet');
  const doc = new DOMParser().parseFromString(strFromU8(xml), 'application/xml');
  const TABLE = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
  const OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
  const table = doc.getElementsByTagNameNS(TABLE, 'table')[0];
  if (!table) return [];
  const rows: Cell[][] = [];
  for (const rowEl of Array.from(table.getElementsByTagNameNS(TABLE, 'table-row'))) {
    const row: Cell[] = [];
    for (const cellEl of Array.from(rowEl.children)) {
      if (cellEl.localName !== 'table-cell' && cellEl.localName !== 'covered-table-cell') continue;
      const repeat = Math.min(
        Number(cellEl.getAttributeNS(TABLE, 'number-columns-repeated') ?? '1') || 1,
        64,
      );
      const type = cellEl.getAttributeNS(OFFICE, 'value-type');
      let value: Cell = cellEl.textContent?.trim() ?? '';
      if (type === 'date')
        value = new Date(`${(cellEl.getAttributeNS(OFFICE, 'date-value') ?? '').slice(0, 19)}Z`);
      else if (type === 'time') {
        const m = /PT(\d+)H(\d+)M/.exec(cellEl.getAttributeNS(OFFICE, 'time-value') ?? '');
        if (m) value = `${pad(Number(m[1]))}:${pad(Number(m[2]))}`;
      } else if (type === 'float') value = Number(cellEl.getAttributeNS(OFFICE, 'value'));
      for (let i = 0; i < repeat; i += 1) row.push(value);
    }
    while (row.length > 0 && text(row[row.length - 1] ?? null) === '') row.pop();
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

export async function readTable(file: File): Promise<Cell[][]> {
  const extension = (file.name.split('.').pop() ?? '').toLowerCase();
  if (extension === 'xlsx') {
    const { readSheet } = await import('read-excel-file/browser');
    return (await readSheet(file)) as unknown as Cell[][];
  }
  if (extension === 'ods') return readOds(await file.arrayBuffer());
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') {
    const Papa = (await import('papaparse')).default;
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true });
    return parsed.data;
  }
  throw new UnsupportedFileError(extension);
}
