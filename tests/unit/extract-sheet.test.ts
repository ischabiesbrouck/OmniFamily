import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  parseTimeCell,
  readOds,
  readTable,
  rowsToCandidates,
  type Cell,
} from '@/lib/extract/spreadsheet';
import type { ExtractOptions } from '@/lib/extract/types';

const options: ExtractOptions = {
  locale: 'nl-NL',
  now: new Date('2026-10-20T10:00:00Z'),
  timeZone: 'Europe/Amsterdam',
  members: [
    { id: 'id-sem', name: 'Sem' },
    { id: 'id-lotte', name: 'Lotte' },
  ],
  fallbackTitle: 'Event',
};
const brief = (rows: Cell[][]) =>
  rowsToCandidates(rows, options).map((c) => [
    c.title,
    c.date,
    c.startTime ?? '-',
    c.endTime ?? '-',
    c.memberIds.join(','),
  ]);

describe('spreadsheet import', () => {
  it('maps a Dutch header row: Datum, Tijd, Wat, Wie', () => {
    expect(
      brief([
        ['Schoolkalender 2026'],
        ['Datum', 'Tijd', 'Wat', 'Wie'],
        ['24-10-2026', '19:00 - 20:30', 'Zwemles', 'Sem'],
        ['31/10/2026', '', 'Halloween', ''],
        ['geen datum', '10:00', 'overgeslagen', ''],
      ]),
    ).toEqual([
      ['Zwemles', '2026-10-24', '19:00', '20:30', 'id-sem'],
      ['Halloween', '2026-10-31', '-', '-', ''],
    ]);
  });

  it('reads Excel-typed cells: Date objects, serial numbers and time fractions', () => {
    expect(
      brief([
        ['Date', 'Start', 'End', 'Event', 'Location'],
        [new Date(Date.UTC(2026, 10, 3)), 0.375, 0.40625, 'Dentist for Lotte', 'Smile clinic'],
        [46_331, '4pm', '5:30 PM', 'Football', ''],
      ]),
    ).toEqual([
      ['Dentist for Lotte', '2026-11-03', '09:00', '09:45', 'id-lotte'],
      ['Football', '2026-11-05', '16:00', '17:30', ''],
    ]);
    expect(
      rowsToCandidates(
        [
          ['Date', 'Event', 'Location'],
          ['2026-11-03', 'X', 'Smile clinic'],
        ],
        options,
      )[0]?.location,
    ).toBe('Smile clinic');
  });

  it('reads US-ordered dates for en-US and falls back to text parsing without a header', () => {
    const us = rowsToCandidates(
      [
        ['Date', 'What'],
        ['11/3/2026', 'Dentist'],
      ],
      { ...options, locale: 'en-US' },
    );
    expect(us[0]?.date).toBe('2026-11-03');
    expect(brief([['Tandarts', 'dinsdag 3 november', '9:15']])).toEqual([
      ['Tandarts', '2026-11-03', '09:15', '-', ''],
    ]);
  });

  it('parses time cells strictly', () => {
    expect(
      ['19:00', '19.30', '7pm', '12 am', '9h15', '0.5', '7', 'later'].map((v) => parseTimeCell(v)),
    ).toEqual(['19:00', '19:30', '19:00', '00:00', '09:15', undefined, undefined, undefined]);
    expect(parseTimeCell(0.5)).toBe('12:00');
  });

  it('reads an OpenDocument (.ods) spreadsheet with typed date and time cells', async () => {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
<office:body><office:spreadsheet><table:table table:name="Blad1">
<table:table-row><table:table-cell office:value-type="string"><text:p>Datum</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Tijd</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Wat</text:p></table:table-cell></table:table-row>
<table:table-row><table:table-cell office:value-type="date" office:date-value="2026-10-24"><text:p>24-10-26</text:p></table:table-cell><table:table-cell office:value-type="time" office:time-value="PT19H00M00S"><text:p>19:00</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Zwemles</text:p></table:table-cell><table:table-cell table:number-columns-repeated="1000"/></table:table-row>
<table:table-row table:number-rows-repeated="1000"><table:table-cell table:number-columns-repeated="1000"/></table:table-row>
</table:table></office:spreadsheet></office:body></office:document-content>`;
    const zip = zipSync({
      mimetype: strToU8('application/vnd.oasis.opendocument.spreadsheet'),
      'content.xml': strToU8(content),
    });
    const rows = await readOds(
      zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer,
    );
    expect(rows).toHaveLength(2);
    expect(brief(rows)).toEqual([['Zwemles', '2026-10-24', '19:00', '-', '']]);
  });

  it('reads CSV through the same entry point the app uses', async () => {
    const file = new File(['Date;Time;What\n24/10/2026;10:00;Market\n'], 'plan.csv', {
      type: 'text/csv',
    });
    expect(brief(await readTable(file))).toEqual([['Market', '2026-10-24', '10:00', '-', '']]);
    await expect(readTable(new File(['x'], 'old.xls'))).rejects.toThrow(/xls/);
  });
});
