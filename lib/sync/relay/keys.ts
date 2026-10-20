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
  /** Encrypts the invitation (household id, name and data key). */
  aesKey: CryptoKey;
}

/** One random invite secret yields both the event's author key and its encryption key. */
export async function inviteKeys(secret: Uint8Array<ArrayBuffer>): Promise<InviteKeys> {
  const keys = await signingKeys(secret, 'invite-author');
  const aesKey = await crypto.subtle.importKey(
    'raw',
    await hkdfBits(secret, 'invite-key'),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
  return { ...keys, aesKey };
}
