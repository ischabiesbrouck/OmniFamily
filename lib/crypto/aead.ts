import { fromBase64, toBase64 } from './encoding';

/**
 * AES-GCM-256 sealing for everything that leaves the device (SPEC D5, §5.5). Each message
 * gets a fresh random 96-bit IV; with random IVs the collision probability stays negligible
 * far beyond the number of messages a household will ever exchange (NIST SP 800-38D §8.3).
 */
const IV_BYTES = 12;

export async function seal(
  key: CryptoKey,
  value: unknown,
  additionalData?: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      ...(additionalData ? { additionalData: new TextEncoder().encode(additionalData) } : {}),
    },
    key,
    plaintext,
  );
  const out = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), IV_BYTES);
  return toBase64(out);
}

/** Throws if the message was tampered with, truncated or sealed under another key. */
export async function open(
  key: CryptoKey,
  sealed: string,
  additionalData?: string,
): Promise<unknown> {
  const bytes = fromBase64(sealed);
  if (bytes.length <= IV_BYTES) throw new Error('Sealed message too short');
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: bytes.slice(0, IV_BYTES),
      ...(additionalData ? { additionalData: new TextEncoder().encode(additionalData) } : {}),
    },
    key,
    bytes.slice(IV_BYTES),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
