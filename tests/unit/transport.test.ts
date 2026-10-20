import { describe, expect, it } from 'vitest';
import { hostCandidatesOnly, RTC_CONFIG } from '@/lib/sync/transport.webrtc';

describe('WebRTC transport (D3)', () => {
  it('uses no STUN/TURN servers', () => {
    expect(RTC_CONFIG.iceServers).toEqual([]);
  });

  it('keeps only host candidates in the SDP', () => {
    const sdp = [
      'v=0',
      'a=candidate:1 1 udp 2122260223 192.168.1.20 54321 typ host generation 0',
      'a=candidate:2 1 udp 2122260223 4f1c.local 54322 typ host',
      'a=candidate:3 1 udp 1686052607 203.0.113.7 61000 typ srflx raddr 192.168.1.20 rport 54321',
      'a=candidate:4 1 udp 41885439 198.51.100.9 3478 typ relay raddr 203.0.113.7 rport 61000',
      'a=end-of-candidates',
    ].join('\r\n');
    const out = hostCandidatesOnly(sdp);
    expect(out).toContain('typ host generation 0');
    expect(out).toContain('4f1c.local');
    expect(out).not.toContain('srflx');
    expect(out).not.toContain('relay');
    expect(out).toContain('a=end-of-candidates');
  });
});
