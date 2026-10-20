import { fromBase64, timingSafeEqual, toBase64 } from './encoding';

/**
 * PIN hashing and throttling (SPEC D5).
 *
 * Threat model: a 4-digit PIN has ~10⁴ entropy and is a UX speed bump on a shared screen,
 * not a security boundary.
 */

export const PBKDF2_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
const HASH_BITS = 256;
const SCHEME = 'pbkdf2-sha256';

export const FREE_ATTEMPTS = 5;
export const LOCKOUT_AFTER = 10;
export const BACKOFF_BASE_MS = 1_000;
export const LOCKOUT_MS = 15 * 60 * 1000;

export const PIN_PATTERN = /^\d{4,8}$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      material,
      HASH_BITS,
    ),
  );
}

export interface PinHash {
  /** base64 of the 16-byte random salt */
  salt: string;
  /** `pbkdf2-sha256$<iterations>$<base64 hash>` so the cost can be raised later */
  hash: string;
}

export async function hashPin(
  pin: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<PinHash> {
  if (!isValidPin(pin)) throw new RangeError('PIN must be 4–8 digits');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await derive(pin, salt, iterations);
  return { salt: toBase64(salt), hash: `${SCHEME}$${iterations}$${toBase64(bits)}` };
}

export async function checkPin(pin: string, stored: PinHash): Promise<boolean> {
  const [scheme, iterationsText, expected] = stored.hash.split('$');
  const iterations = Number(iterationsText);
  if (scheme !== SCHEME || !Number.isInteger(iterations) || expected === undefined) {
    throw new Error('Unsupported PIN hash format');
  }
  if (!isValidPin(pin)) return false;
  const bits = await derive(pin, fromBase64(stored.salt), iterations);
  return timingSafeEqual(bits, fromBase64(expected));
}

/** Per-member failure state, kept on this device only. */
export interface PinAttemptState {
  failures: number;
  /** epoch ms before which no attempt is evaluated */
  blockedUntil: number;
}

export const NO_ATTEMPTS: PinAttemptState = { failures: 0, blockedUntil: 0 };

/** Wait imposed after the n-th consecutive failure: none for 1–4, 1 s·2^(n-5) for 5–9, 15 min from 10. */
export function delayAfterFailures(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  if (failures >= LOCKOUT_AFTER) return LOCKOUT_MS;
  return BACKOFF_BASE_MS * 2 ** (failures - FREE_ATTEMPTS);
}

export function registerFailure(state: PinAttemptState, now: number): PinAttemptState {
  const failures = state.failures + 1;
  return { failures, blockedUntil: now + delayAfterFailures(failures) };
}

export type PinVerdict =
  | { ok: true }
  | { ok: false; reason: 'wrong'; failures: number; retryAt: number }
  | { ok: false; reason: 'throttled' | 'locked'; failures: number; retryAt: number }
  | { ok: false; reason: 'no_pin' };

export function blockedVerdict(state: PinAttemptState, now: number): PinVerdict | undefined {
  if (now >= state.blockedUntil) return undefined;
  return {
    ok: false,
    reason: state.failures >= LOCKOUT_AFTER ? 'locked' : 'throttled',
    failures: state.failures,
    retryAt: state.blockedUntil,
  };
}
