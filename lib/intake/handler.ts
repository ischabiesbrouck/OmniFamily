import type { IntakeProvider } from './provider';
import {
  MAX_IMAGE_BYTES,
  MAX_TEXT_LENGTH,
  validateIntakeRequest,
  validateParsedEntry,
} from './schema';

/** Upper bound for a request body: the largest image (base64) plus text and envelope. */
const MAX_BODY_BYTES = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + MAX_TEXT_LENGTH * 4 + 4_096;
const PROVIDER_TIMEOUT_MS = 20_000;

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/**
 * The whole of `/api/intake` (D2): stateless, persists nothing, logs nothing. The request is
 * forwarded to the provider and its answer validated before it reaches the client.
 */
export async function handleIntake(
  request: Request,
  provider: IntakeProvider | null,
): Promise<Response> {
  if (!provider) return reply(503, { error: 'intake_unavailable' });

  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return reply(413, { error: 'too_large' });
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'too_large' });
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: 'invalid_request' });
  }
  const input = validateIntakeRequest(body);
  if (!input) return reply(400, { error: 'invalid_request' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const parsed = validateParsedEntry(await provider.parse(input, controller.signal));
    return parsed ? reply(200, parsed) : reply(502, { error: 'intake_failed' });
  } catch {
    return reply(502, { error: 'intake_failed' });
  } finally {
    clearTimeout(timer);
  }
}
