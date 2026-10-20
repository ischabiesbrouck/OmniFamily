// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LOCKOUT_MS } from '@/lib/crypto/pin';
import {
  createHousehold,
  getHousehold,
  HouseholdExistsError,
  type CreateHouseholdInput,
} from '@/lib/db/repositories/household';
import { getPinAttempts, setMemberPin, verifyMemberPin } from '@/lib/db/repositories/members';
import { setupRepositories } from './helpers';

const FAST = { pinIterations: 1_000 };
const input: CreateHouseholdInput = {
  householdName: '  De Vries  ',
  deviceName: 'Kitchen tablet',
  members: [
    { name: 'Anna', colorHex: '#1d4ed8', role: 'parent', pin: '4321' },
    { name: 'Sem', colorHex: '#b91c1c', role: 'child' },
  ],
};

describe('household vault creation', () => {
  it('creates household, device and members atomically', async () => {
    const { db, repos } = setupRepositories();
    const { household, members } = await createHousehold(repos.core, input, FAST);

    expect(household).toMatchObject({ householdName: 'De Vries', isMasterDevice: true });
    expect(await getHousehold(db)).toEqual(household);
    const devices = await repos.devices.list();
    expect(devices).toHaveLength(1);
    expect(devices[0]?.id).toBe(household.deviceId);
    expect(members.map((m) => [m.name, m.role, m.pinHash !== undefined])).toEqual([
      ['Anna', 'parent', true],
      ['Sem', 'child', false],
    ]);
    // device + 2 members, all queued for sync
    expect(await db.outbox.count()).toBe(3);
  });

  it('allows only one household per device (N2)', async () => {
    const { repos } = setupRepositories();
    await createHousehold(repos.core, input, FAST);
    await expect(createHousehold(repos.core, input, FAST)).rejects.toBeInstanceOf(
      HouseholdExistsError,
    );
  });
});

describe('PIN set / verify with backoff', () => {
  async function parent() {
    const ctx = setupRepositories();
    const { members } = await createHousehold(ctx.repos.core, input, FAST);
    return { ...ctx, anna: members[0]!, sem: members[1]! };
  }

  it('verifies the correct PIN', async () => {
    const { repos, anna } = await parent();
    expect(await verifyMemberPin(repos.core, anna.id, '4321')).toEqual({ ok: true });
  });

  it('reports no_pin for a member without one, and supports set / clear', async () => {
    const { repos, sem } = await parent();
    expect(await verifyMemberPin(repos.core, sem.id, '0000')).toEqual({
      ok: false,
      reason: 'no_pin',
    });
    await setMemberPin(repos.core, sem.id, '9876', FAST);
    expect(await verifyMemberPin(repos.core, sem.id, '9876')).toEqual({ ok: true });
    const cleared = await setMemberPin(repos.core, sem.id, null);
    expect(cleared.pinHash).toBeUndefined();
    expect(cleared.pinSalt).toBeUndefined();
  });

  it('backs off after 5 wrong PINs, rejecting even the right PIN while throttled', async () => {
    const { repos, clock, anna } = await parent();
    for (let i = 1; i <= 4; i += 1) {
      expect(await verifyMemberPin(repos.core, anna.id, '0000')).toMatchObject({
        reason: 'wrong',
        failures: i,
        retryAt: clock.now,
      });
    }
    expect(await verifyMemberPin(repos.core, anna.id, '0000')).toMatchObject({
      reason: 'wrong',
      failures: 5,
      retryAt: clock.now + 1_000,
    });

    // Correct PIN during the backoff window is not even evaluated.
    expect(await verifyMemberPin(repos.core, anna.id, '4321')).toMatchObject({
      ok: false,
      reason: 'throttled',
    });

    clock.now += 1_000;
    expect(await verifyMemberPin(repos.core, anna.id, '0000')).toMatchObject({
      failures: 6,
      retryAt: clock.now + 2_000,
    });
    clock.now += 2_000;
    expect(await verifyMemberPin(repos.core, anna.id, '4321')).toEqual({ ok: true });
    expect(await getPinAttempts(repos.core, anna.id)).toEqual({ failures: 0, blockedUntil: 0 });
  });

  it('locks out for 15 minutes after 10 failures', async () => {
    const { repos, clock, anna } = await parent();
    for (let i = 1; i <= 10; i += 1) {
      const verdict = await verifyMemberPin(repos.core, anna.id, '1111');
      expect(verdict).toMatchObject({ reason: 'wrong', failures: i });
      if (i < 10 && !verdict.ok && verdict.reason === 'wrong') clock.now = verdict.retryAt;
    }
    const lockedAt = clock.now;
    expect(await getPinAttempts(repos.core, anna.id)).toEqual({
      failures: 10,
      blockedUntil: lockedAt + LOCKOUT_MS,
    });
    clock.now += LOCKOUT_MS - 1;
    expect(await verifyMemberPin(repos.core, anna.id, '4321')).toMatchObject({ reason: 'locked' });
    clock.now += 1;
    expect(await verifyMemberPin(repos.core, anna.id, '4321')).toEqual({ ok: true });
  });

  it('keeps PIN attempts on this device only (never in the outbox)', async () => {
    const { db, repos, anna } = await parent();
    const before = await db.outbox.count();
    await verifyMemberPin(repos.core, anna.id, '0000');
    expect(await db.outbox.count()).toBe(before);
  });
});
