/**
 * WebRTC DataChannel with manual (QR) signalling — no signalling server (SPEC D3).
 * No STUN/TURN servers are configured, so only host (LAN) candidates are gathered; any
 * other candidate type is stripped from the SDP as a second line of defence.
 */

export const RTC_CONFIG: RTCConfiguration = { iceServers: [] };
const ICE_GATHERING_TIMEOUT_MS = 5_000;
const CHANNEL_OPEN_TIMEOUT_MS = 30_000;
const CHANNEL_LABEL = 'omnifamily-sync';

export function hostCandidatesOnly(sdp: string): string {
  return sdp
    .split(/\r\n/)
    .filter((line) => !line.startsWith('a=candidate:') || / typ host( |$)/.test(line))
    .join('\r\n');
}

function iceGathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ICE_GATHERING_TIMEOUT_MS); // use what we have
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

function opened(dc: RTCDataChannel): Promise<RTCDataChannel> {
  if (dc.readyState === 'open') return Promise.resolve(dc);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Connection timed out')),
      CHANNEL_OPEN_TIMEOUT_MS,
    );
    dc.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(dc);
    });
    dc.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('Connection failed'));
    });
  });
}

export interface PeerHandle {
  pc: RTCPeerConnection;
  sdp: string;
  channel: Promise<RTCDataChannel>;
}

/** Device A: creates the offer that goes into the first QR code. */
export async function createOffer(): Promise<PeerHandle> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const dc = pc.createDataChannel(CHANNEL_LABEL, { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  await iceGathered(pc);
  return { pc, sdp: hostCandidatesOnly(pc.localDescription?.sdp ?? ''), channel: opened(dc) };
}

/** Device B: answers the scanned offer; the answer goes into the second QR code. */
export async function answerOffer(offerSdp: string): Promise<PeerHandle> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const channel = new Promise<RTCDataChannel>((resolve, reject) => {
    pc.addEventListener('datachannel', (event) => {
      if (event.channel.label === CHANNEL_LABEL) opened(event.channel).then(resolve, reject);
    });
  });
  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await iceGathered(pc);
  return { pc, sdp: hostCandidatesOnly(pc.localDescription?.sdp ?? ''), channel };
}

/** Device A: applies the scanned answer; the channel then opens on both sides. */
export async function acceptAnswer(pc: RTCPeerConnection, answerSdp: string): Promise<void> {
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
}
