import { schnorr } from '@noble/curves/secp256k1.js';

/**
 * The few Nostr primitives relay sync needs (NIP-01, NIP-78). Relays only accept signed
 * events, so each household signs with a key derived from its data key (D-10.2). The
 * signature is transport plumbing; confidentiality and integrity come from AES-GCM.
 */
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrFilter {
  kinds?: number[];
  authors?: string[];
  since?: number;
}

/** NIP-78 "application-specific data": addressable, so a newer event replaces an older one. */
export const APP_DATA_KIND = 30078;

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function publicKeyOf(secretKey: Uint8Array): string {
  return toHex(schnorr.getPublicKey(secretKey));
}

export interface EventTemplate {
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export async function eventId(pubkey: string, t: EventTemplate): Promise<string> {
  const serialized = JSON.stringify([0, pubkey, t.created_at, t.kind, t.tags, t.content]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return toHex(new Uint8Array(digest));
}

export async function signEvent(
  template: EventTemplate,
  secretKey: Uint8Array,
): Promise<NostrEvent> {
  const pubkey = publicKeyOf(secretKey);
  const id = await eventId(pubkey, template);
  const sig = toHex(schnorr.sign(fromHex(id), secretKey));
  return { ...template, id, pubkey, sig };
}

export function isNostrEvent(value: unknown): value is NostrEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.pubkey === 'string' &&
    typeof v.created_at === 'number' &&
    typeof v.kind === 'number' &&
    typeof v.content === 'string' &&
    Array.isArray(v.tags) &&
    v.tags.every((t) => Array.isArray(t) && t.every((s) => typeof s === 'string'))
  );
}

export function tagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find((t) => t[0] === name)?.[1];
}
