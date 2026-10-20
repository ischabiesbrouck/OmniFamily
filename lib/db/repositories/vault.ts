import Dexie from 'dexie';
import type { NexusDB } from '../schema';

export const EXPORT_FORMAT = 'omnifamily-vault';
export const EXPORT_VERSION = 1;

/**
 * Export vault (GDPR Art. 20, SPEC §7.4): every record this device holds, as JSON.
 * Secrets stay out: PIN hashes and salts, the device identity and the household data key.
 * Tombstones are left out too; they carry no user data a person would want back.
 */
export async function exportVault(db: NexusDB, now: number = Date.now()) {
  const live = <T extends { deletedAt?: number }>(rows: T[]) =>
    rows.filter((r) => r.deletedAt === undefined);
  const household = await db.household.toCollection().first();
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    household: household
      ? {
          householdId: household.householdId,
          householdName: household.householdName,
          createdAt: household.createdAt,
        }
      : null,
    members: live(await db.members.toArray()).map(({ pinHash, pinSalt, ...member }) => member),
    devices: live(await db.devices.toArray()),
    events: live(await db.events.toArray()),
    tasks: live(await db.tasks.toArray()),
    groceries: live(await db.groceries.toArray()),
    points: live(await db.points.toArray()),
  };
}

export type VaultExport = Awaited<ReturnType<typeof exportVault>>;

/**
 * Delete everything (GDPR Art. 17, SPEC §7.4): the IndexedDB vault (records, keys, settings),
 * every Cache Storage entry, the service worker and this device's local preferences.
 */
export async function deleteEverything(db: NexusDB): Promise<void> {
  db.close();
  await Dexie.delete(db.name);
  if (typeof caches !== 'undefined') {
    for (const key of await caches.keys()) await caches.delete(key);
  }
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    for (const registration of await navigator.serviceWorker.getRegistrations())
      await registration.unregister();
  }
  if (typeof localStorage !== 'undefined') localStorage.clear();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
}
