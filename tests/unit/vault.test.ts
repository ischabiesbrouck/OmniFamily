// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createEvent } from '@/lib/db/repositories/events';
import { createHousehold, getHousehold } from '@/lib/db/repositories/household';
import { deleteEverything, exportVault } from '@/lib/db/repositories/vault';
import { NexusDB } from '@/lib/db/schema';
import { setupRepositories } from './helpers';

describe('export vault / delete everything (§7.4)', () => {
  it('exports every live record but no secrets', async () => {
    const { db, repos } = setupRepositories();
    await createHousehold(
      repos.core,
      {
        householdName: 'Jansen',
        deviceName: 'Tablet',
        members: [{ name: 'Eva', colorHex: '#1e40af', role: 'parent', pin: '1234' }],
      },
      { pinIterations: 1_000 },
    );
    const keep = await createEvent(repos.core, {
      title: 'Dentist',
      description: '',
      location: '',
      isAllDay: false,
      date: '2026-10-24',
      endDate: '2026-10-24',
      startTime: '09:00',
      endTime: '09:30',
      timeZone: 'UTC',
      memberIds: [],
      visibility: 'family',
      repeat: 'none',
      createdById: 'x',
    });
    const gone = await createEvent(repos.core, {
      ...(await repos.events.get(keep.id))!,
      title: 'Old',
      date: '2026-10-25',
      endDate: '2026-10-25',
      startTime: '09:00',
      endTime: '10:00',
      description: '',
      location: '',
      repeat: 'none',
    } as never);
    await repos.events.remove(gone.id);

    const vault = await exportVault(db, Date.UTC(2026, 9, 20));
    expect(vault).toMatchObject({
      format: 'omnifamily-vault',
      version: 1,
      household: { householdName: 'Jansen' },
    });
    expect(vault.events.map((e) => e.title)).toEqual(['Dentist']);
    const json = JSON.stringify(vault);
    expect(json).not.toMatch(/pinHash|pinSalt|pbkdf2|deviceIdentity|householdKey|privateKey/);
    expect(vault.members[0]).toMatchObject({ name: 'Eva', role: 'parent' });
  });

  it('deletes the whole IndexedDB vault, keys included', async () => {
    const { db, repos } = setupRepositories();
    await createHousehold(
      repos.core,
      {
        householdName: 'X',
        deviceName: 'Y',
        members: [{ name: 'Z', colorHex: '#1e40af', role: 'parent' }],
      },
      { pinIterations: 1_000 },
    );
    await deleteEverything(db);
    const reopened = new NexusDB(db.name);
    expect(await getHousehold(reopened)).toBeUndefined();
    expect(await reopened.settings.count()).toBe(0);
    expect(await reopened.members.count()).toBe(0);
  });
});
