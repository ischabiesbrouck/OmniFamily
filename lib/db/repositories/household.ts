import { generateIdentity, isDeviceIdentity, type DeviceIdentity } from '@/lib/crypto/identity';
import { generateHouseholdKey } from '@/lib/crypto/householdKey';
import { hashPin, type PinHash } from '@/lib/crypto/pin';
import type { FamilyMember, HouseholdContext, MemberRole, NexusDB } from '../schema';
import type { RepositoryCore } from './core';

export const IDENTITY_KEY = 'deviceIdentity';
/** AES-GCM-256 household data key that encrypts all sync traffic (D5). */
export const HOUSEHOLD_KEY = 'householdKey';

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
  const householdKey = await generateHouseholdKey();
  const hashes = await Promise.all(
    input.members.map((m) => (m.pin ? hashPin(m.pin, options.pinIterations) : undefined)),
  );

  return core.write(['device', 'member'], async (w) => {
    if (await core.db.household.count()) throw new HouseholdExistsError();

    await w.setSetting(IDENTITY_KEY, identity);
    await w.setSetting(HOUSEHOLD_KEY, householdKey);
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

export async function getHouseholdKey(db: NexusDB): Promise<CryptoKey | undefined> {
  const row = await db.settings.get(HOUSEHOLD_KEY);
  return row?.value instanceof CryptoKey ? row.value : undefined;
}

/** Households created before sync existed get their data key on first pairing. */
export async function ensureHouseholdKey(db: NexusDB): Promise<CryptoKey> {
  const existing = await getHouseholdKey(db);
  if (existing) return existing;
  const key = await generateHouseholdKey();
  await db.settings.put({ key: HOUSEHOLD_KEY, value: key });
  return key;
}

export interface JoinHouseholdInput {
  householdId: string;
  householdName: string;
  householdKey: CryptoKey;
  deviceName: string;
}

/**
 * Makes this (empty) device a member of an existing household received over pairing: its
 * own non-extractable identity, the shared data key, its device record and the context.
 */
export async function joinHousehold(
  core: RepositoryCore,
  input: JoinHouseholdInput,
): Promise<HouseholdContext> {
  if (await getHousehold(core.db)) throw new HouseholdExistsError();
  const identity = await generateIdentity();
  return core.write(['device'], async (w) => {
    if (await core.db.household.count()) throw new HouseholdExistsError();
    await w.setSetting(IDENTITY_KEY, identity);
    await w.setSetting(HOUSEHOLD_KEY, input.householdKey);
    await w.insert('device', {
      id: w.deviceId,
      name: input.deviceName.trim(),
      publicKeyJwk: identity.publicKeyJwk,
      revoked: false,
      lastSeenAt: w.now,
    });
    const household: HouseholdContext = {
      householdId: input.householdId,
      householdName: input.householdName,
      deviceId: w.deviceId,
      isMasterDevice: false,
      createdAt: w.now,
    };
    await w.setHousehold(household);
    return household;
  });
}
