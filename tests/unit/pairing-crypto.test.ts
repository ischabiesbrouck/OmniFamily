// @vitest-environment node
import jsQR from 'jsqr';
import qrcode from 'qrcode-generator';
import { describe, expect, it } from 'vitest';
import { open, seal } from '@/lib/crypto/aead';
import {
  createEphemeralKeys,
  derivePairingSecret,
  exportHouseholdKey,
  generateHouseholdKey,
  importHouseholdKey,
} from '@/lib/crypto/pairing';
import { decodeBase45, encodeBase45 } from '@/lib/sync/base45';
import {
  decodeFrames,
  encodeFrames,
  FrameCollector,
  MAX_FRAME_DATA,
  parseFrame,
} from '@/lib/sync/qrPayload';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('Base45 (RFC 9285)', () => {
  it('matches the RFC test vectors', () => {
    expect(encodeBase45(bytes('AB'))).toBe('BB8');
    expect(encodeBase45(bytes('Hello!!'))).toBe('%69 VD92EX0');
    expect(encodeBase45(bytes('base-45'))).toBe('UJCLQE7W581');
    expect(new TextDecoder().decode(decodeBase45('QED8WEX0'))).toBe('ietf!');
  });

  it('round-trips arbitrary bytes and rejects invalid input', () => {
    const random = crypto.getRandomValues(new Uint8Array(1001));
    expect(decodeBase45(encodeBase45(random))).toEqual(random);
    expect(() => decodeBase45('GGW')).toThrow(); // 65535 < value
    expect(() => decodeBase45('a')).toThrow();
  });
});

describe('QR payload framing', () => {
  const offer = {
    sdp: 'v=0\r\n'.repeat(80) + 'a=candidate:1 1 udp 2122260223 192.168.1.20 54321 typ host\r\n',
    publicKey: 'x'.repeat(88),
  };

  it('fits a typical offer in one frame and round-trips', async () => {
    const frames = await encodeFrames(offer);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatch(/^OF1\/1\/1\/[0-9A-Z $%*+\-./:]+$/);
    expect(await decodeFrames(frames)).toEqual(offer);
  });

  it('splits large payloads and reassembles frames in any order', async () => {
    const big = { blob: Array.from({ length: 400 }, (_, i) => `${i}:${Math.random()}`) };
    const frames = await encodeFrames(big);
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.every((f) => parseFrame(f).data.length <= MAX_FRAME_DATA)).toBe(true);
    expect(await decodeFrames([...frames].reverse())).toEqual(big);

    const collector = new FrameCollector();
    collector.add(frames[0]!);
    expect(collector.complete).toBe(false);
  });

  it('survives a real QR code: encode with qrcode-generator, decode with jsQR', async () => {
    const [frame] = await encodeFrames(offer);
    const qr = qrcode(0, 'M');
    qr.addData(frame!, 'Alphanumeric');
    qr.make();
    const cell = 4;
    const margin = 4;
    const size = (qr.getModuleCount() + margin * 2) * cell;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const row = Math.floor(y / cell) - margin;
        const col = Math.floor(x / cell) - margin;
        const dark =
          row >= 0 &&
          col >= 0 &&
          row < qr.getModuleCount() &&
          col < qr.getModuleCount() &&
          qr.isDark(row, col);
        if (dark) pixels.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3);
      }
    }
    const scanned = jsQR(pixels, size, size);
    expect(scanned?.data).toBe(frame);
    expect(qr.getModuleCount()).toBeLessThanOrEqual(4 * 25 + 17); // ≤ version 25
  });
});

describe('pairing key agreement', () => {
  it('both sides derive the same key and check code; a third party does not', async () => {
    const a = await createEphemeralKeys();
    const b = await createEphemeralKeys();
    const mallory = await createEphemeralKeys();
    const onA = await derivePairingSecret(a, b.publicKey, a.publicKey, b.publicKey);
    const onB = await derivePairingSecret(b, a.publicKey, a.publicKey, b.publicKey);
    const onM = await derivePairingSecret(mallory, a.publicKey, a.publicKey, mallory.publicKey);

    expect(onA.checkCode).toMatch(/^\d{6}$/);
    expect(onA.checkCode).toBe(onB.checkCode);
    expect(onM.checkCode).not.toBe(onA.checkCode);
    expect(onA.key.extractable).toBe(false);

    const sealed = await seal(onA.key, { hello: 'B' });
    expect(await open(onB.key, sealed)).toEqual({ hello: 'B' });
    await expect(open(onM.key, sealed)).rejects.toThrow();
  });
});

describe('AES-GCM sealing', () => {
  it('uses a fresh IV per message and detects tampering', async () => {
    const key = await generateHouseholdKey();
    const a = await seal(key, { n: 1 });
    const b = await seal(key, { n: 1 });
    expect(a.slice(0, 16)).not.toBe(b.slice(0, 16)); // different IVs
    expect(await open(key, a)).toEqual({ n: 1 });

    const raw = Buffer.from(a, 'base64');
    raw[raw.length - 1]! ^= 1;
    await expect(open(key, raw.toString('base64'))).rejects.toThrow();
    await expect(open(key, await seal(key, 'x', 'household-1'), 'household-2')).rejects.toThrow();
  });

  it('household keys survive export/import for the paired device', async () => {
    const key = await generateHouseholdKey();
    const copy = await importHouseholdKey(await exportHouseholdKey(key));
    expect(await open(copy, await seal(key, 'shared'))).toBe('shared');
  });
});
