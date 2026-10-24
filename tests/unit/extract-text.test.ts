import { describe, expect, it } from 'vitest';
import { extractFromText } from '@/lib/extract/text';
import type { ExtractOptions } from '@/lib/extract/types';

const options = (locale: string): ExtractOptions => ({
  locale,
  now: new Date('2026-10-20T10:00:00Z'), // Tuesday
  timeZone: 'Europe/Amsterdam',
  members: [
    { id: 'id-sem', name: 'Sem' },
    { id: 'id-daan', name: 'Daan' },
  ],
  fallbackTitle: 'Event',
});
const pick = (c: ReturnType<typeof extractFromText>[number]) => {
  const { key: _key, source: _source, ...rest } = c;
  return rest;
};

describe('on-device text extraction', () => {
  it('reads a Dutch message with weekday, time and people', () => {
    expect(
      extractFromText('Zwemmen zaterdag 24 oktober om 10:00 voor Sem', options('nl-NL')).map(pick),
    ).toEqual([
      { title: 'Zwemmen', date: '2026-10-24', startTime: '10:00', memberIds: ['id-sem'] },
    ]);
  });

  it('reads Dutch ranges with dots and a location', () => {
    expect(
      extractFromText('Ouderavond do 29/10 19.30-21.00 @ De Klimop', options('nl-NL')).map(pick),
    ).toEqual([
      {
        title: 'Ouderavond',
        date: '2026-10-29',
        startTime: '19:30',
        endTime: '21:00',
        location: 'De Klimop',
        memberIds: [],
      },
    ]);
  });

  it('reads English relative dates and pm ranges', () => {
    expect(
      extractFromText(
        'Football practice next Tuesday 4pm-5:30pm with Sem and Daan',
        options('en-GB'),
      ).map(pick),
    ).toEqual([
      {
        title: 'Football practice',
        date: '2026-10-27',
        startTime: '16:00',
        endTime: '17:30',
        memberIds: ['id-sem', 'id-daan'],
      },
    ]);
  });

  it('reads 3/11 day-first, except for US English', () => {
    expect(extractFromText('Dentist on 3/11 at 9:15', options('en-GB'))[0]).toMatchObject({
      date: '2026-11-03',
      startTime: '09:15',
      title: 'Dentist',
    });
    expect(extractFromText('Dentist on 3/11 at 9:15', options('en-US'))[0]).toMatchObject({
      date: '2027-03-11',
    });
  });

  it('makes date-only lines all-day, and finds one entry per line of a pasted list', () => {
    const text = [
      'Hi all! Reminder for next week:',
      'Schoolreisje 12 november',
      'Morgen om 8 uur tandarts',
      '',
      'Birthday party Sat 31 Oct',
      'Thanks, see you!',
    ].join('\n');
    expect(
      extractFromText(text, options('nl-NL')).map((c) => [
        c.title,
        c.date,
        c.startTime ?? 'all-day',
      ]),
    ).toEqual([
      ['Schoolreisje', '2026-11-12', 'all-day'],
      ['Tandarts', '2026-10-21', '08:00'],
      ['Birthday party', '2026-10-31', 'all-day'],
    ]);
  });

  it('falls back to a generic title when a line is only a date', () => {
    expect(extractFromText('24-10-2026', options('nl-NL'))[0]).toMatchObject({
      title: 'Event',
      date: '2026-10-24',
    });
  });

  it('keeps a date of today when its time has already passed (not next year)', () => {
    const lateSaturday = { ...options('en-GB'), now: new Date('2026-10-24T09:25:00Z') }; // 11:25
    expect(
      extractFromText('Swimming Saturday 24 October 10:00-11:00', lateSaturday).map(pick),
    ).toEqual([
      {
        title: 'Swimming',
        date: '2026-10-24',
        startTime: '10:00',
        endTime: '11:00',
        memberIds: [],
      },
    ]);
    // A weekday alone still means the coming one.
    expect(extractFromText('Piano Monday 15:00', lateSaturday)[0]?.date).toBe('2026-10-26');
  });

  it('finds nothing in text without dates', () => {
    expect(extractFromText('Hello there\nSee you soon', options('en-GB'))).toEqual([]);
  });
});

describe('wrapped lines (OCR, e-mail)', () => {
  it('re-joins a date split over two lines', () => {
    const ocr = 'Swimming lesson Saturday 24 October\n2026 at 10:00\n';
    expect(extractFromText(ocr, options('en-GB')).map(pick)).toEqual([
      { title: 'Swimming lesson', date: '2026-10-24', startTime: '10:00', memberIds: [] },
    ]);
    expect(
      extractFromText('Ouderavond donderdag 29 oktober\nom 19.30 uur', options('nl-NL'))[0],
    ).toMatchObject({
      title: 'Ouderavond',
      startTime: '19:30',
    });
  });
});
