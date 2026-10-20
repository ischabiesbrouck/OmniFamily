import { createEphemeralKeys, derivePairingSecret } from '@/lib/crypto/pairing';
import type { RepositoryCore } from '@/lib/db/repositories/core';
import { fromDataChannel } from './channel';
import { decodeFrames, encodeFrames, textToFrames } from './qrPayload';
import { SyncSession, type SessionOptions } from './syncEngine';
import { acceptAnswer, answerOffer, createOffer } from './transport.webrtc';

interface SignalPayload {
  v: 1;
  role: 'offer' | 'answer';
  sdp: string;
  pk: string;
}

export class PairingCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PairingCodeError';
  }
}

async function readPayload(text: string, role: SignalPayload['role']): Promise<SignalPayload> {
  let value: unknown;
  try {
    value = await decodeFrames(textToFrames(text));
  } catch {
    throw new PairingCodeError('unreadable');
  }
  const p = value as Partial<SignalPayload>;
  if (p?.v !== 1 || p.role !== role || typeof p.sdp !== 'string' || typeof p.pk !== 'string') {
    throw new PairingCodeError('wrong_code');
  }
  return p as SignalPayload;
}

export interface ConnectedPairing {
  checkCode: string;
  session: SyncSession;
  /** Resolves when the vault exchange is complete and the session is live. */
  ready: Promise<void>;
}

export interface HostPairing {
  frames: string[];
  complete(answerText: string): Promise<ConnectedPairing>;
  cancel(): void;
}

/** Device A (already holds the household): show `frames`, then feed it the answer code. */
export async function startHostPairing(
  core: RepositoryCore,
  options: SessionOptions,
): Promise<HostPairing> {
  const keys = await createEphemeralKeys();
  const offer = await createOffer();
  const frames = await encodeFrames({
    v: 1,
    role: 'offer',
    sdp: offer.sdp,
    pk: keys.publicKey,
  } satisfies SignalPayload);
  return {
    frames,
    cancel: () => offer.pc.close(),
    async complete(answerText) {
      const answer = await readPayload(answerText, 'answer');
      const secret = await derivePairingSecret(keys, answer.pk, keys.publicKey, answer.pk);
      await acceptAnswer(offer.pc, answer.sdp);
      const dc = await offer.channel;
      const session = new SyncSession(core, fromDataChannel(dc), secret.key, options);
      return { checkCode: secret.checkCode, session, ready: session.start() };
    },
  };
}

export interface JoinPairing {
  frames: string[];
  checkCode: string;
  /** Resolves once device A has scanned our answer and the channel opened. */
  connected: Promise<ConnectedPairing>;
  cancel(): void;
}

/** Device B: scan A's code, show our answer `frames`, then wait for the vault. */
export async function joinWithOfferCode(
  core: RepositoryCore,
  offerText: string,
  options: SessionOptions,
): Promise<JoinPairing> {
  const offer = await readPayload(offerText, 'offer');
  const keys = await createEphemeralKeys();
  const secret = await derivePairingSecret(keys, offer.pk, offer.pk, keys.publicKey);
  const answer = await answerOffer(offer.sdp);
  const frames = await encodeFrames({
    v: 1,
    role: 'answer',
    sdp: answer.sdp,
    pk: keys.publicKey,
  } satisfies SignalPayload);
  const connected = answer.channel.then((dc) => {
    const session = new SyncSession(core, fromDataChannel(dc), secret.key, options);
    return { checkCode: secret.checkCode, session, ready: session.start() };
  });
  return { frames, checkCode: secret.checkCode, connected, cancel: () => answer.pc.close() };
}
