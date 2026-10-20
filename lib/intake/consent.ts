import type { NexusDB } from '@/lib/db/schema';

/**
 * Opt-in consent for the AI intake (GDPR Arts. 6(1)(a), 7, 8; SPEC §7.1). Device-local and
 * revocable; without it no snippet is ever sent.
 */
export const INTAKE_CONSENT_KEY = 'intakeConsent';
/** Bump when the disclosure text changes materially, so consent is asked again. */
export const CONSENT_VERSION = 1;

export interface IntakeConsent {
  version: number;
  grantedAt: number;
}

export function isConsent(value: unknown): value is IntakeConsent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.version === CONSENT_VERSION && typeof v.grantedAt === 'number';
}

export async function grantConsent(db: NexusDB, now: number): Promise<void> {
  await db.settings.put({
    key: INTAKE_CONSENT_KEY,
    value: { version: CONSENT_VERSION, grantedAt: now },
  });
}

export async function revokeConsent(db: NexusDB): Promise<void> {
  await db.settings.delete(INTAKE_CONSENT_KEY);
}
