/**
 * Family codes (D-10.8): 10 characters of Crockford Base32 (50 bits), shown as ABCDE-12345.
 * Short enough to type, and with a slow key derivation (see keys.ts) and a 15-minute life
 * far too many to guess. Look-alikes are forgiven: O→0, I/L→1; case and dashes are ignored.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 10;

export function newInviteCode(): string {
  // 256 is a multiple of 32, so masking each random byte is unbiased.
  return Array.from(
    crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH)),
    (b) => ALPHABET[b & 31],
  ).join('');
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** The canonical code in whatever was typed, scanned or pasted (a link or the code), or null. */
export function parseInviteCode(text: string): string | null {
  const fromLink = /#join=([^&\s]+)/.exec(text)?.[1];
  const raw = (fromLink ?? text)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (raw.length !== INVITE_CODE_LENGTH) return null;
  return [...raw].every((c) => ALPHABET.includes(c)) ? raw : null;
}

export function inviteLink(code: string, pageUrl: string): string {
  return `${pageUrl}#join=${formatInviteCode(code)}`;
}
