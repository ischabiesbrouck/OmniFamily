/** Base45 (RFC 9285): the QR "alphanumeric" alphabet, ~30 % denser in a QR than base64. */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

export function encodeBase45(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    const a = bytes[i] ?? 0;
    if (i + 1 < bytes.length) {
      let n = a * 256 + (bytes[i + 1] ?? 0);
      const c = n % 45;
      n = (n - c) / 45;
      const d = n % 45;
      const e = (n - d) / 45;
      out += ALPHABET[c]! + ALPHABET[d]! + ALPHABET[e]!;
    } else {
      out += ALPHABET[a % 45]! + ALPHABET[Math.floor(a / 45)]!;
    }
  }
  return out;
}

export function decodeBase45(text: string): Uint8Array<ArrayBuffer> {
  if (text.length % 3 === 1) throw new SyntaxError('Invalid Base45 length');
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 3) {
    const chunk = text.slice(i, i + 3);
    const values = [...chunk].map((ch) => {
      const v = INDEX.get(ch);
      if (v === undefined) throw new SyntaxError(`Invalid Base45 character "${ch}"`);
      return v;
    });
    const [c = 0, d = 0, e] = values;
    if (e === undefined) {
      const n = c + d * 45;
      if (n > 0xff) throw new SyntaxError('Invalid Base45 value');
      bytes.push(n);
    } else {
      const n = c + d * 45 + e * 2025;
      if (n > 0xffff) throw new SyntaxError('Invalid Base45 value');
      bytes.push(n >> 8, n & 0xff);
    }
  }
  return new Uint8Array(bytes);
}
