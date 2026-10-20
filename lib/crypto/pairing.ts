import { fromBase64, toBase64 } from './encoding';

/**
 * Pairing (SPEC D5): ephemeral ECDH P-256 → HKDF-SHA-256 → AES-GCM-256 pairing key.
 * The pairing key wraps the household data key (AES-GCM-256) for the joining device.
 * The QR exchange is the authenticated channel; a 6-digit check code derived from the same
 * secret lets people confirm both screens agree, which exposes a substituted QR code.
 */

const ECDH: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };
const PAIRING_INFO = 'omnifamily-pairing-v1';
const CHECK_INFO = 'omnifamily-check-code-v1';

export interface EphemeralKeys {
  privateKey: CryptoKey;
  /** base64 of the 65-byte uncompressed public point */
  publicKey: string;
}

export async function createEphemeralKeys(): Promise<EphemeralKeys> {
  const pair = await crypto.subtle.generateKey(ECDH, false, ['deriveBits']);
  return {
    privateKey: pair.privateKey,
    publicKey: toBase64(await crypto.subtle.exportKey('raw', pair.publicKey)),
  };
}

export interface PairingSecret {
  key: CryptoKey;
  /** six digits both screens show */
  checkCode: string;
}

/**
 * Both sides call this with the same `offerPublicKey` / `answerPublicKey` pair (in that order),
 * so they derive the same key and check code.
 */
export async function derivePairingSecret(
  own: EphemeralKeys,
  peerPublicKey: string,
  offerPublicKey: string,
  answerPublicKey: string,
): Promise<PairingSecret> {
  const peer = await crypto.subtle.importKey('raw', fromBase64(peerPublicKey), ECDH, false, []);
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peer },
    own.privateKey,
    256,
  );
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, [
    'deriveKey',
    'deriveBits',
  ]);
  const salt = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${offerPublicKey}|${answerPublicKey}`),
    ),
  );
  const hkdf = (info: string) => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt,
    info: new TextEncoder().encode(info),
  });
  const key = await crypto.subtle.deriveKey(
    hkdf(PAIRING_INFO),
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const checkBits = new DataView(await crypto.subtle.deriveBits(hkdf(CHECK_INFO), material, 32));
  const checkCode = String(checkBits.getUint32(0) % 1_000_000).padStart(6, '0');
  return { key, checkCode };
}

/** The household data key encrypts all sync traffic. Extractable only so it can be handed to a paired device. */
export function generateHouseholdKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportHouseholdKey(key: CryptoKey): Promise<string> {
  return toBase64(await crypto.subtle.exportKey('raw', key));
}

export function importHouseholdKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(raw), { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}
