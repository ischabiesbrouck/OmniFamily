import { fromBase64, toBase64 } from './encoding';

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
