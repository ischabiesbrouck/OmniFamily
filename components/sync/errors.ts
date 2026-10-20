import { PairingCodeError } from '@/lib/sync/pairingFlow';
import { SyncError } from '@/lib/sync/syncEngine';

export type SyncErrorKey =
  | 'unreadable'
  | 'wrong_code'
  | 'household_mismatch'
  | 'no_household'
  | 'closed'
  | 'protocol'
  | 'timeout';

/** Maps any pairing/sync failure to a catalogue key under `sync.errors`. */
export function errorKey(error: unknown): SyncErrorKey {
  if (error instanceof PairingCodeError)
    return error.message === 'wrong_code' ? 'wrong_code' : 'unreadable';
  if (error instanceof SyncError) return error.code;
  if (error instanceof Error && /timed out|failed/i.test(error.message)) return 'timeout';
  return 'protocol';
}
