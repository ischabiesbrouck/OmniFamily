// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateIdentity, sign, verify } from '@/lib/crypto/identity';
import {
  checkPin,
  delayAfterFailures,
  hashPin,
  LOCKOUT_MS,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
} from '@/lib/crypto/pin';
import { fromBase64 } from '@/lib/crypto/encoding';
import { createHousehold, getIdentity } from '@/lib/db/repositories/household';
import { setupRepositories } from './helpers';

const data = new TextEncoder().encode('household-sync-payload');

describe('device identity (ECDSA P-256)', () => {
  it('generates a non-extractable private key that can still sign', async () => {
    const identity = await generateIdentity();
    expect(identity.privateKey.extractable).toBe(false);
    expect(identity.privateKey.algorithm).toMatchObject({ name: 'ECDSA', namedCurve: 'P-256' });
    await expect(crypto.subtle.exportKey('jwk', identity.privateKey)).rejects.toThrow();
    await expect(crypto.subtle.exportKey('pkcs8', identity.privateKey)).rejects.toThrow();

    const signature = await sign(identity, data);
    expect(await verify(identity.publicKeyJwk, signature, data)).toBe(true);
    expect(identity.publicKeyJwk).not.toHaveProperty('d'); // no private scalar leaks via JWK
  });

  it('stays non-extractable after being persisted in IndexedDB and reloaded', async () => {
    const { db, repos } = setupRepositories();
    await createHousehold(
      repos.core,
      {
        householdName: 'Jansen',
        deviceName: 'Kitchen',
        members: [{ name: 'Eva', colorHex: '#1d4ed8', role: 'parent' }],
      },
      { pinIterations: 1_000 },
    );
    const stored = await getIdentity(db);
    expect(stored?.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('jwk', stored!.privateKey)).rejects.toThrow();
    const device = await repos.devices.list();
    expect(device[0]?.publicKeyJwk).toEqual(stored?.publicKeyJwk);
    expect(await verify(device[0]!.publicKeyJwk, await sign(stored!, data), data)).toBe(true);
  });
});

describe('PIN hashing (PBKDF2-HMAC-SHA-256)', () => {
  it('uses ≥ 600 000 iterations and a 16-byte random salt by default', async () => {
    const a = await hashPin('2468');
    const b = await hashPin('2468');
    expect(a.hash.startsWith(`pbkdf2-sha256$${PBKDF2_ITERATIONS}$`)).toBe(true);
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(fromBase64(a.salt)).toHaveLength(SALT_BYTES);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await checkPin('2468', a)).toBe(true);
    expect(await checkPin('2469', a)).toBe(false);
  });

  it('rejects malformed PINs', async () => {
    await expect(hashPin('12a4', 1_000)).rejects.toThrow(RangeError);
    await expect(hashPin('123', 1_000)).rejects.toThrow(RangeError);
    expect(await checkPin('abc', await hashPin('1234', 1_000))).toBe(false);
  });

  it('backs off exponentially after 5 failures and locks out for 15 minutes from 10', () => {
    expect([1, 2, 3, 4].map(delayAfterFailures)).toEqual([0, 0, 0, 0]);
    expect([5, 6, 7, 8, 9].map(delayAfterFailures)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000]);
    expect(delayAfterFailures(10)).toBe(LOCKOUT_MS);
    expect(delayAfterFailures(11)).toBe(LOCKOUT_MS);
    expect(LOCKOUT_MS).toBe(15 * 60 * 1000);
  });
});
