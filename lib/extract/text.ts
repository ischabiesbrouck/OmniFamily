import * as chrono from 'chrono-node';
import { formatFloatingDate, formatWallTime } from '@/lib/time/zoned';
import type { Candidate, ExtractOptions } from './types';

type Parsed = chrono.ParsedResult;

/**
 * Dates in free text (SPEC D2, on-device variant D-9.1): chat messages, e-mails, school
 * letters, OCR output. English and Dutch parsers both run per line; the one that
 * recognises the most text wins.
 */
function parsersFor(locale: string) {
  // Everyone but en-US writes the day first: 3/11 is 3 November.
  const english = /^en-US\b/i.test(locale) ? chrono.en.casual : chrono.en.GB;
  const dutch = chrono.nl.casual;
  return locale.toLowerCase().startsWith('nl') ? [dutch, english] : [english, dutch];
}

// Little words left at the edges once the date is cut out ("Dentist on", "om", "van").
// Whole words only, so "Dentist" keeps its "De".
const WORDS = 'on|at|om|op|van|from|to|tot|the|de|het|vanaf|until|uur|in';
const LEADING = new RegExp(`^(?:[\\s,.:;–—-]+|(?:${WORDS})(?=[\\s,.:;–—-]|$))+`, 'iu');
const TRAILING = new RegExp(`(?:[\\s,.:;–—-]+|(?<=^|[\\s,.:;–—-])(?:${WORDS}))+$`, 'iu');
/** Spans like "next week" or "over 2 weken": chrono turns them into a date, but they are not events. */
const VAGUE =
  /^(?:(?:next|this|last|coming|in|over|volgende|deze|vorige|komende)\s+)?(?:\d+\s+)?(?:weeks?|months?|years?|weken|maand(?:en)?|jaar)(?:\s+(?:from now|later))?$/iu;

const LOCATION = /(?:@\s*|\b(?:locatie|location|plaats|waar|where)\s*:\s*)([^,\n;]+)/iu;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanTitle(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i += 1) t = t.replace(LEADING, '').replace(TRAILING, '').trim();
  return t ? t.charAt(0).toLocaleUpperCase() + t.slice(1) : '';
}

function bestParse(line: string, options: ExtractOptions): Parsed[] {
  const reference = { instant: options.now, timezone: options.timeZone };
  let best: Parsed[] = [];
  let bestCoverage = 0;
  for (const parser of parsersFor(options.locale)) {
    // Only results that pin down a day: "next week" or "in October" are not events.
    const results = parser
      .parse(line, reference, { forwardDate: true })
      .filter(
        (r) =>
          (r.start.isCertain('day') || r.start.isCertain('weekday')) && !VAGUE.test(r.text.trim()),
      );
    const coverage = results.reduce((sum, r) => sum + r.text.length, 0);
    if (coverage > bestCoverage) {
      best = results;
      bestCoverage = coverage;
    }
  }
  return best;
}

function membersIn(text: string, members: ExtractOptions['members']): string[] {
  return members
    .filter(
      (m) =>
        m.name.trim() &&
        new RegExp(`(?<![\\p{L}\\p{N}])${escape(m.name.trim())}(?![\\p{L}\\p{N}])`, 'iu').test(
          text,
        ),
    )
    .map((m) => m.id);
}

/** Removes "for Sem", "voor Sem en Daan" etc. once those people are attached as members. */
function withoutPeople(text: string, members: ExtractOptions['members']): string {
  const names = members
    .map((m) => m.name.trim())
    .filter(Boolean)
    .map(escape);
  if (names.length === 0) return text;
  const list = `(?:${names.join('|')})(?:\\s*(?:,|and|en|&)\\s*(?:${names.join('|')}))*`;
  return text.replace(new RegExp(`\\b(?:for|voor|with|met)\\s+${list}`, 'giu'), ' ');
}

function toCandidate(
  line: string,
  result: Parsed,
  options: ExtractOptions,
  index: number,
): Candidate {
  const { start, end } = result;
  const date = formatFloatingDate({
    year: start.get('year') ?? 0,
    month: start.get('month') ?? 1,
    day: start.get('day') ?? 1,
  });
  const timed = start.isCertain('hour');
  const startTime = timed
    ? formatWallTime({ hour: start.get('hour') ?? 0, minute: start.get('minute') ?? 0 })
    : undefined;
  let endTime: string | undefined;
  let endDate: string | undefined;
  if (end) {
    if (timed && end.isCertain('hour'))
      endTime = formatWallTime({ hour: end.get('hour') ?? 0, minute: end.get('minute') ?? 0 });
    const lastDay = formatFloatingDate({
      year: end.get('year') ?? 0,
      month: end.get('month') ?? 1,
      day: end.get('day') ?? 1,
    });
    if (!timed && lastDay > date) endDate = lastDay;
  }

  const location = LOCATION.exec(line)?.[1]?.trim();
  const rest = line.slice(0, result.index) + ' ' + line.slice(result.index + result.text.length);
  const titleText = withoutPeople(rest.replace(LOCATION, ' '), options.members);
  return {
    key: `${index}:${date}:${startTime ?? 'all-day'}:${result.index}`,
    title: cleanTitle(titleText) || options.fallbackTitle,
    date,
    ...(startTime ? { startTime } : {}),
    ...(endTime && startTime && endTime > startTime ? { endTime } : {}),
    ...(endDate ? { endDate } : {}),
    ...(location ? { location } : {}),
    memberIds: membersIn(line, options.members),
    source: line.trim(),
  };
}

/** A line that only continues the previous line's date: "2026 at 10:00", "om 19.30", "4pm". */
const CONTINUATION =
  /^(?:\d{4}\b|at\b|om\b|from\b|van\b|tot\b|until\b|\d{1,2}[:.]\d{2}\b|\d{1,2}\s*(?:am|pm|uur|u)\b)/iu;

/**
 * Lines, with wrapped dates re-joined: OCR and e-mail line breaks often split
 * "Saturday 24 October" from "2026 at 10:00".
 */
function logicalLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const previous = lines[lines.length - 1];
    if (previous !== undefined && CONTINUATION.test(line))
      lines[lines.length - 1] = `${previous} ${line}`;
    else lines.push(line);
  }
  return lines;
}

export function extractFromText(text: string, options: ExtractOptions): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  logicalLines(text).forEach((line, lineIndex) => {
    for (const result of bestParse(line, options)) {
      const candidate = toCandidate(line, result, options, lineIndex);
      const identity = `${candidate.title}|${candidate.date}|${candidate.startTime ?? ''}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      candidates.push(candidate);
    }
  });
  return candidates;
}
