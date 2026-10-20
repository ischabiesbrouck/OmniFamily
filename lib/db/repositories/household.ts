import { generateIdentity, isDeviceIdentity, type DeviceIdentity } from '@/lib/crypto/identity';
import { hashPin, type PinHash } from '@/lib/crypto/pin';
import type { FamilyMember, HouseholdContext, MemberRole, NexusDB } from '../schema';
import type { RepositoryCore } from './core';

export const IDENTITY_KEY = 'deviceIdentity';

export class HouseholdExistsError extends Error {
  constructor() {
    super('This device already holds a household vault');
    this.name = 'HouseholdExistsError';
  }
}

export interface NewMemberInput {
  name: string;
  colorHex: string;
  role: MemberRole;
  pin?: string | undefined;
}

export interface CreateHouseholdInput {
  householdName: string;
  deviceName: string;
  /** The first member is the person setting up this device. */
  members: [NewMemberInput, ...NewMemberInput[]];
}

export interface CreatedHousehold {
  household: HouseholdContext;
  members: FamilyMember[];
}

export interface HashOptions {
  /** Test-only override; production always uses PBKDF2_ITERATIONS. */
  pinIterations?: number;
}

export function pinFields(hash: PinHash | undefined): Pick<FamilyMember, 'pinSalt' | 'pinHash'> {
  return hash ? { pinSalt: hash.salt, pinHash: hash.hash } : {};
}

/**
 * Creates the household vault on this device: a non-extractable ECDSA identity, the device
 * registry entry, the founding members and the household context — atomically.
 * One household per device (N2).
 */
export async function createHousehold(
  core: RepositoryCore,
  input: CreateHouseholdInput,
  options: HashOptions = {},
): Promise<CreatedHousehold> {
  if (await getHousehold(core.db)) throw new HouseholdExistsError();

  // Web Crypto is async and cannot run inside the IndexedDB transaction (D-1.3).
  const identity = await generateIdentity();
  const hashes = await Promise.all(
    input.members.map((m) => (m.pin ? hashPin(m.pin, options.pinIterations) : undefined)),
  );

  return core.write(['device', 'member'], async (w) => {
    if (await core.db.household.count()) throw new HouseholdExistsError();

    await w.setSetting(IDENTITY_KEY, identity);
    await w.insert('device', {
      id: w.deviceId,
      name: input.deviceName.trim(),
      publicKeyJwk: identity.publicKeyJwk,
      revoked: false,
      lastSeenAt: w.now,
    });

    const members: FamilyMember[] = [];
    for (const [index, member] of input.members.entries()) {
      members.push(
        await w.insert('member', {
          name: member.name.trim(),
          colorHex: member.colorHex,
          role: member.role,
          ...pinFields(hashes[index]),
        }),
      );
    }

    const household: HouseholdContext = {
      householdId: crypto.randomUUID(),
      householdName: input.householdName.trim(),
      deviceId: w.deviceId,
      isMasterDevice: true,
      createdAt: w.now,
    };
    await w.setHousehold(household);
    return { household, members };
  });
}

export async function getHousehold(db: NexusDB): Promise<HouseholdContext | undefined> {
  return db.household.toCollection().first();
}

export async function getIdentity(db: NexusDB): Promise<DeviceIdentity | undefined> {
  const row = await db.settings.get(IDENTITY_KEY);
  return isDeviceIdentity(row?.value) ? row.value : undefined;
}
