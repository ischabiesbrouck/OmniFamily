import { publicKeyOf } from './nostr';

const SALT = new TextEncoder().encode('omnifamily-relay-v1');

async function hkdfBits(
  ikm: Uint8Array<ArrayBuffer>,
  info: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode(info) },
    base,
    256,
  );
  return new Uint8Array(bits);
}

export interface SigningKeys {
  secretKey: Uint8Array<ArrayBuffer>;
  pubkey: string;
}

async function signingKeys(ikm: Uint8Array<ArrayBuffer>, info: string): Promise<SigningKeys> {
  const secretKey = await hkdfBits(ikm, info);
  return { secretKey, pubkey: publicKeyOf(secretKey) };
}

/**
 * Every device of a household derives the same relay identity from the household data key,
 * so relays can be asked for "this household's events" and nobody else can write them.
 */
export async function householdSigningKeys(householdKey: CryptoKey): Promise<SigningKeys> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', householdKey));
  return signingKeys(raw, 'household-author');
}

export interface InviteKeys extends SigningKeys {
  /** Encrypts the invitation (household, data key, members). */
  aesKey: CryptoKey;
  /** The invitation's `d` tag: derived too, so invitations cannot be picked out on a relay. */
  address: string;
}

/**
 * PBKDF2 iterations for a family code (OWASP 2023 for PBKDF2-HMAC-SHA256: 600 000; a 50-bit
 * code alive for 15 minutes needs far less, and a phone must derive it in well under a second).
 */
export const INVITE_PBKDF2_ITERATIONS = 200_000;

/** One family code yields the invitation's author key, encryption key and address. */
export async function inviteKeys(
  code: string,
  iterations: number = INVITE_PBKDF2_ITERATIONS,
): Promise<InviteKeys> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations },
      base,
      256,
    ),
  );
  const keys = await signingKeys(secret, 'invite-author');
  const aesKey = await crypto.subtle.importKey(
    'raw',
    await hkdfBits(secret, 'invite-key'),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
  const address = Array.from((await hkdfBits(secret, 'invite-address')).slice(0, 16), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  return { ...keys, aesKey, address };
}
