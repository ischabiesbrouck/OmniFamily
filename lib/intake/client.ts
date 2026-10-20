import type { FamilyMember, ParsedFamilyEntry } from '@/lib/db/schema';
import { withBase } from '@/lib/pwa/basePath';
import { minimize, restoreIds, restoreNames } from './minimize';
import { validateParsedEntry, type IntakeRequest } from './schema';

export const INTAKE_ENDPOINT = withBase('/api/intake');
const CLIENT_TIMEOUT_MS = 25_000;

export type IntakeResult =
  | { ok: true; entry: ParsedFamilyEntry }
  | { ok: false; reason: 'offline' | 'unavailable' | 'failed' };

/**
 * Online-only and optional (D2). Never throws: every failure becomes a result the UI can
 * show next to the always-available manual form.
 */
export async function requestIntake(
  text: string,
  members: readonly Pick<FamilyMember, 'id' | 'name'>[],
  context: { timeZone: string; locale: string; now?: Date },
  fetcher: typeof fetch = fetch,
): Promise<IntakeResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return { ok: false, reason: 'offline' };
  const { text: anonymised, tokens } = minimize(text, members);
  const body: IntakeRequest = {
    text: anonymised,
    people: [...tokens.keys()],
    timeZone: context.timeZone,
    locale: context.locale,
    now: (context.now ?? new Date()).toISOString(),
  };

  let response: Response;
  try {
    response = await fetcher(INTAKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 503) return { ok: false, reason: 'unavailable' };
  if (!response.ok) return { ok: false, reason: 'failed' };

  const entry = validateParsedEntry(await response.json().catch(() => undefined));
  if (!entry) return { ok: false, reason: 'failed' };
  return {
    ok: true,
    entry: {
      ...entry,
      title: restoreNames(entry.title, tokens, members),
      ...(entry.location ? { location: restoreNames(entry.location, tokens, members) } : {}),
      assigneeIds: restoreIds(entry.assigneeIds, tokens),
      ...(entry.linkedTasks
        ? {
            linkedTasks: entry.linkedTasks.map((t) => ({
              title: restoreNames(t.title, tokens, members),
              ...(t.assigneeId && tokens.get(t.assigneeId)
                ? { assigneeId: tokens.get(t.assigneeId) }
                : {}),
            })),
          }
        : {}),
    },
  };
}
