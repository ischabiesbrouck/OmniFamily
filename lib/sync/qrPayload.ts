import { decodeBase45, encodeBase45 } from './base45';

/**
 * Pairing payload for QR codes (SPEC D3): JSON → gzip → Base45, split into frames of
 * `OF1/<index>/<count>/<data>`. One frame is a single static QR; more frames are shown as an
 * animated QR and reassembled in any order by the scanner.
 */
export const FRAME_PREFIX = 'OF1';
/** Characters of Base45 data per frame; keeps each QR at a comfortably scannable version. */
export const MAX_FRAME_DATA = 900;

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeFrames(
  value: unknown,
  maxData: number = MAX_FRAME_DATA,
): Promise<string[]> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const data = encodeBase45(await pipe(json, new CompressionStream('gzip')));
  const count = Math.max(1, Math.ceil(data.length / maxData));
  return Array.from(
    { length: count },
    (_, i) => `${FRAME_PREFIX}/${i + 1}/${count}/${data.slice(i * maxData, (i + 1) * maxData)}`,
  );
}

export interface ParsedFrame {
  index: number;
  count: number;
  data: string;
}

export function parseFrame(text: string): ParsedFrame {
  const match = /^OF1\/(\d+)\/(\d+)\/(.*)$/s.exec(text.trim());
  if (!match) throw new SyntaxError('Not an OmniFamily pairing code');
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (index < 1 || count < 1 || index > count || count > 64)
    throw new SyntaxError('Invalid frame header');
  return { index, count, data: match[3] ?? '' };
}

/** Collects frames from a scanner; `complete` once every frame has been seen. */
export class FrameCollector {
  private frames = new Map<number, string>();
  private count = 0;

  add(text: string): { received: number; count: number } {
    const frame = parseFrame(text);
    if (this.count !== 0 && frame.count !== this.count) this.frames.clear();
    this.count = frame.count;
    this.frames.set(frame.index, frame.data);
    return { received: this.frames.size, count: this.count };
  }

  get complete(): boolean {
    return this.count > 0 && this.frames.size === this.count;
  }

  joined(): string {
    if (!this.complete) throw new Error('Frames missing');
    return Array.from({ length: this.count }, (_, i) => this.frames.get(i + 1) ?? '').join('');
  }
}

export async function decodeFrames(frames: readonly string[]): Promise<unknown> {
  const collector = new FrameCollector();
  for (const f of frames) collector.add(f);
  const bytes = await pipe(decodeBase45(collector.joined()), new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Frames as one pasteable text block (manual fallback when no camera is available). */
export function framesToText(frames: readonly string[]): string {
  return frames.join('\n');
}

export function textToFrames(text: string): string[] {
  return text
    .split(/\s*\n\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
}
