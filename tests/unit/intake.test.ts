// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/intake/route';
import type { ParsedFamilyEntry } from '@/lib/db/schema';
import { requestIntake } from '@/lib/intake/client';
import { handleIntake } from '@/lib/intake/handler';
import { minimize, restoreIds, restoreNames } from '@/lib/intake/minimize';
import type { IntakeProvider } from '@/lib/intake/provider';
import type { IntakeRequest } from '@/lib/intake/schema';
import { entryToDraft } from '@/lib/intake/toDraft';

const members = [
  { id: 'id-anna', name: 'Anna' },
  { id: 'id-annalena', name: 'Anna-Lena' },
  { id: 'id-sem', name: 'Sem' },
];
const validRequest: IntakeRequest = {
  text: 'Swimming Saturday 10:00 for P1',
  people: ['P1'],
  timeZone: 'Europe/Amsterdam',
  now: '2026-10-20T08:00:00.000Z',
  locale: 'nl-NL',
};
const entry: ParsedFamilyEntry = {
  title: 'Swimming with P1',
  startInstant: '2026-10-24T08:00:00.000Z',
  endInstant: '2026-10-24T09:00:00.000Z',
  timeZone: 'Europe/Amsterdam',
  isAllDay: false,
  assigneeIds: ['P1'],
  confidenceScore: 0.9,
  linkedTasks: [{ title: 'Pack towel for P1', assigneeId: 'P1' }],
  linkedGroceries: [{ item: 'Goggles', category: 'Other' }],
};
const post = (body: unknown) =>
  new Request('http://localhost/api/intake', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const provider = (answer: () => Promise<unknown>): IntakeProvider => ({ parse: () => answer() });

afterEach(() => vi.restoreAllMocks());

describe('/api/intake (D2)', () => {
  it('answers 503 while no provider is configured — the v1 default', async () => {
    const res = await POST(post(validRequest));
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'intake_unavailable' });
  });

  it('validates input before calling the provider', async () => {
    const parse = vi.fn();
    const p: IntakeProvider = { parse };
    expect((await handleIntake(post('not json'), p)).status).toBe(400);
    expect((await handleIntake(post({ ...validRequest, text: '' }), p)).status).toBe(400);
    expect((await handleIntake(post({ ...validRequest, timeZone: 'Mars/Base' }), p)).status).toBe(
      400,
    );
    expect((await handleIntake(post({ ...validRequest, text: 'x'.repeat(2_001) }), p)).status).toBe(
      400,
    );
    expect(
      (
        await handleIntake(
          post({ ...validRequest, image: { mediaType: 'image/gif', data: 'x' } }),
          p,
        )
      ).status,
    ).toBe(400);
    expect(parse).not.toHaveBeenCalled();
  });

  it('returns a validated entry, and rejects whatever a provider makes up', async () => {
    const ok = await handleIntake(
      post(validRequest),
      provider(async () => entry),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual(entry);

    const bogus = await handleIntake(
      post(validRequest),
      provider(async () => ({ ...entry, startInstant: 'tomorrow' })),
    );
    expect(bogus.status).toBe(502);
    const backwards = await handleIntake(
      post(validRequest),
      provider(async () => ({ ...entry, endInstant: '2026-10-23T00:00:00Z' })),
    );
    expect(backwards.status).toBe(502);
    const thrown = await handleIntake(
      post(validRequest),
      provider(async () => Promise.reject(new Error('down'))),
    );
    expect(thrown.status).toBe(502);
  });

  it('logs nothing and keeps nothing', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m),
    );
    await handleIntake(
      post(validRequest),
      provider(async () => entry),
    );
    await handleIntake(
      post(validRequest),
      provider(async () => Promise.reject(new Error('down'))),
    );
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('data minimisation (§7.2)', () => {
  it('replaces member names with tokens, longest first, whole words only', () => {
    const { text, tokens } = minimize('Anna-Lena and anna take Sem; Annabel stays home', members);
    expect(text).toBe('P1 and P2 take P3; Annabel stays home');
    expect([...tokens.entries()]).toEqual([
      ['P1', 'id-annalena'],
      ['P2', 'id-anna'],
      ['P3', 'id-sem'],
    ]);
    expect(restoreNames('Lift for P3 and P1', tokens, members)).toBe('Lift for Sem and Anna-Lena');
    expect(restoreIds(['P3', 'P9', 'P3'], tokens)).toEqual(['id-sem']);
  });

  it('the request leaving the device contains no member names', async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ ...entry, assigneeIds: ['P1'] }), { status: 200 }),
    );
    const result = await requestIntake(
      'Swimming Saturday 10:00 for Sem',
      members,
      {
        timeZone: 'Europe/Amsterdam',
        locale: 'nl-NL',
      },
      fetcher,
    );

    const sent = JSON.parse(
      String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(sent.text).toBe('Swimming Saturday 10:00 for P1');
    expect(JSON.stringify(sent)).not.toMatch(/Sem|Anna/);
    expect(sent.people).toEqual(['P1']);

    expect(result).toMatchObject({
      ok: true,
      entry: {
        title: 'Swimming with Sem',
        assigneeIds: ['id-sem'],
        linkedTasks: [{ title: 'Pack towel for Sem', assigneeId: 'id-sem' }],
      },
    });
  });
});

describe('intake client failures never throw', () => {
  const ctx = { timeZone: 'UTC', locale: 'en' };
  it('maps 503, network errors and junk to results', async () => {
    expect(
      await requestIntake('x', [], ctx, async () => new Response('{}', { status: 503 })),
    ).toEqual({ ok: false, reason: 'unavailable' });
    expect(
      await requestIntake('x', [], ctx, async () => Promise.reject(new TypeError('network'))),
    ).toEqual({ ok: false, reason: 'offline' });
    expect(
      await requestIntake('x', [], ctx, async () => new Response('nope', { status: 200 })),
    ).toEqual({ ok: false, reason: 'failed' });
    expect(
      await requestIntake('x', [], ctx, async () => new Response('{}', { status: 500 })),
    ).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('parsed entry → event draft', () => {
  it('shows times in the entry’s own zone', () => {
    const draft = entryToDraft({ ...entry, title: 'Swimming', assigneeIds: ['id-sem'] }, 'id-anna');
    expect(draft).toMatchObject({
      date: '2026-10-24',
      startTime: '10:00',
      endTime: '11:00',
      memberIds: ['id-sem'],
      repeat: 'none',
    });
  });

  it('turns an exclusive all-day end into the inclusive last day', () => {
    const draft = entryToDraft(
      {
        ...entry,
        isAllDay: true,
        startInstant: '2026-10-24T00:00:00.000Z',
        endInstant: '2026-10-26T00:00:00.000Z',
        timeZone: 'UTC',
      },
      'id-anna',
    );
    expect(draft).toMatchObject({ isAllDay: true, date: '2026-10-24', endDate: '2026-10-25' });
  });
});
