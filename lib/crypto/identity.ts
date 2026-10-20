/**
 * Household device identity (SPEC D5): ECDSA P-256 whose private key is a
 * non-extractable CryptoKey. It is persisted in IndexedDB by structured clone and can
 * sign, but no code path — including ours — can ever read its bytes.
 */

const ALGORITHM: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' };

export interface DeviceIdentity {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
}

export async function generateIdentity(): Promise<DeviceIdentity> {
  const pair = await crypto.subtle.generateKey(ALGORITHM, false, ['sign', 'verify']);
  if (pair.privateKey.extractable) throw new Error('Identity private key must be non-extractable');
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyJwk };
}

export function isDeviceIdentity(value: unknown): value is DeviceIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.privateKey instanceof CryptoKey &&
    v.publicKey instanceof CryptoKey &&
    typeof v.publicKeyJwk === 'object' &&
    v.publicKeyJwk !== null
  );
}

export async function sign(
  identity: DeviceIdentity,
  data: Uint8Array<ArrayBuffer>,
): Promise<ArrayBuffer> {
  return crypto.subtle.sign(SIGN_PARAMS, identity.privateKey, data);
}

export async function verify(
  publicKeyJwk: JsonWebKey,
  signature: ArrayBuffer,
  data: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  const key = await crypto.subtle.importKey('jwk', publicKeyJwk, ALGORITHM, true, ['verify']);
  return crypto.subtle.verify(SIGN_PARAMS, key, signature, data);
}
