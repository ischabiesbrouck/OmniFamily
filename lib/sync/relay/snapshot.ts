import { openBytes, sealBytes } from '@/lib/crypto/aead';
import { fromBase64, toBase64 } from '@/lib/crypto/encoding';

/**
 * A device's full state as relay events (D-10.3): JSON → gzip → AES-GCM (household key,
 * AAD = household id) → Base64, cut into chunks small enough for common relay limits.
 * Each chunk names its snapshot id, so chunks of an older snapshot are never mixed in.
 */
export const CHUNK_CHARS = 30_000;

export interface Chunk {
  /** Snapshot id: random per publish. */
  s: string;
  i: number;
  n: number;
  c: string;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeSnapshot(
  key: CryptoKey,
  householdId: string,
  value: unknown,
  chunkChars = CHUNK_CHARS,
): Promise<Chunk[]> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const sealed = await sealBytes(key, await pipe(json, new CompressionStream('gzip')), householdId);
  const data = toBase64(sealed);
  const s = toBase64(crypto.getRandomValues(new Uint8Array(9)));
  const n = Math.max(1, Math.ceil(data.length / chunkChars));
  return Array.from({ length: n }, (_, i) => ({
    s,
    i,
    n,
    c: data.slice(i * chunkChars, (i + 1) * chunkChars),
  }));
}

export async function decodeSnapshot(
  key: CryptoKey,
  householdId: string,
  chunks: readonly Chunk[],
): Promise<unknown> {
  const data = [...chunks].sort((a, b) => a.i - b.i).map((c) => c.c).join('');
  const zipped = await openBytes(key, fromBase64(data), householdId);
  const json = await pipe(zipped, new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(json));
}

export function parseChunk(content: string): Chunk | undefined {
  try {
    const v = JSON.parse(content) as Partial<Chunk>;
    if (
      typeof v.s === 'string' &&
      typeof v.c === 'string' &&
      Number.isInteger(v.i) &&
      Number.isInteger(v.n) &&
      (v.n ?? 0) >= 1 &&
      (v.n ?? 0) <= 256 &&
      (v.i ?? -1) >= 0 &&
      (v.i ?? 0) < (v.n ?? 0)
    )
      return v as Chunk;
  } catch {
    // not ours
  }
  return undefined;
}

/** Collects chunks per device; hands back a snapshot once all its chunks are in. */
export class ChunkAssembler {
  private readonly byDevice = new Map<string, Map<string, Map<number, Chunk>>>();
  private readonly done = new Set<string>();

  add(deviceId: string, chunk: Chunk): Chunk[] | null {
    const key = `${deviceId}/${chunk.s}`;
    if (this.done.has(key)) return null;
    let snapshots = this.byDevice.get(deviceId);
    if (!snapshots) this.byDevice.set(deviceId, (snapshots = new Map()));
    let parts = snapshots.get(chunk.s);
    if (!parts) snapshots.set(chunk.s, (parts = new Map()));
    parts.set(chunk.i, chunk);
    if (parts.size < chunk.n) return null;
    this.done.add(key);
    snapshots.delete(chunk.s);
    return [...parts.values()];
  }
}
