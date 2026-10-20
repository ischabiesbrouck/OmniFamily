import {
  blockedVerdict,
  checkPin,
  hashPin,
  NO_ATTEMPTS,
  registerFailure,
  type PinAttemptState,
  type PinVerdict,
} from '@/lib/crypto/pin';
import type { FamilyMember } from '../schema';
import { RecordNotFoundError, type RepositoryCore } from './core';
import { pinFields, type HashOptions } from './household';

const attemptsKey = (memberId: string) => `pinAttempts:${memberId}`;

function isAttemptState(value: unknown): value is PinAttemptState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.failures === 'number' && typeof v.blockedUntil === 'number';
}

export function hasPin(member: Pick<FamilyMember, 'pinHash'>): boolean {
  return member.pinHash !== undefined;
}

/** Sets, replaces (`pin` string) or clears (`null`) a member's PIN. */
export async function setMemberPin(
  core: RepositoryCore,
  memberId: string,
  pin: string | null,
  options: HashOptions = {},
): Promise<FamilyMember> {
  const hash = pin === null ? undefined : await hashPin(pin, options.pinIterations);
  return core.write(['member'], async (w) => {
    const updated = await w.update('member', memberId, {
      pinSalt: undefined,
      pinHash: undefined,
      ...pinFields(hash),
    });
    await core.db.settings.delete(attemptsKey(memberId));
    return updated;
  });
}

export async function getPinAttempts(
  core: RepositoryCore,
  memberId: string,
): Promise<PinAttemptState> {
  const row = await core.db.settings.get(attemptsKey(memberId));
  return isAttemptState(row?.value) ? row.value : NO_ATTEMPTS;
}

/**
 * Checks a PIN with local exponential backoff after 5 failures and a 15-minute lockout
 * after 10 (D5). Throttled attempts are rejected before any hashing happens.
 */
export async function verifyMemberPin(
  core: RepositoryCore,
  memberId: string,
  pin: string,
): Promise<PinVerdict> {
  const member = await core.get('member', memberId);
  if (!member) throw new RecordNotFoundError('member', memberId);
  if (member.pinSalt === undefined || member.pinHash === undefined) {
    return { ok: false, reason: 'no_pin' };
  }

  const state = await getPinAttempts(core, memberId);
  const blocked = blockedVerdict(state, core.time());
  if (blocked) return blocked;

  const ok = await checkPin(pin, { salt: member.pinSalt, hash: member.pinHash });
  if (ok) {
    await core.db.settings.delete(attemptsKey(memberId));
    return { ok: true };
  }

  const next = registerFailure(state, core.time());
  await core.db.settings.put({ key: attemptsKey(memberId), value: next });
  return { ok: false, reason: 'wrong', failures: next.failures, retryAt: next.blockedUntil };
}
