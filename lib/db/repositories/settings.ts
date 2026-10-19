import type { NexusDB } from '../schema';

/** Local, device-only key/value settings (never synced). */
export async function getSetting(db: NexusDB, key: string): Promise<unknown> {
  return (await db.settings.get(key))?.value;
}

export async function setSetting(db: NexusDB, key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
