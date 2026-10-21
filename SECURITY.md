# Security

OmniFamily Nexus keeps every household's data on its own devices. There are no accounts and no server-side storage (SPEC §0, N1).

## Threat model (v1)

- **PIN:** a 4-digit PIN has ~10⁴ entropy and is a _UX speed bump on a shared screen_, not a security boundary.
- **Storage:** IndexedDB is **not** encrypted at rest in v1; the app relies on OS-level device encryption.

Anyone who can open the browser profile on an unlocked device can read the household's data. Enable full-disk encryption and a device lock screen.

## Cryptography (Web Crypto API only)

| Purpose                 | Primitive                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Device identity         | ECDSA P-256; private key is a **non-extractable** `CryptoKey` stored in IndexedDB                           |
| Pairing (Phase 6)       | ECDH P-256 → HKDF-SHA-256 → AES-GCM-256 household data key                                                  |
| Sync payloads (Phase 6) | AES-GCM-256, 96-bit random IV per message, never reused                                                     |
| PIN                     | PBKDF2-HMAC-SHA-256, 600 000 iterations, 16-byte random salt; stored as `pbkdf2-sha256$<iterations>$<hash>` |

PIN throttling is local to each device: exponential backoff (1 s, 2 s, 4 s, 8 s, 16 s) after 5 consecutive failures and a 15-minute lockout from the 10th; a correct PIN resets the counter. PIN attempt counters are never synced.

## Internet sync (behind `NEXT_PUBLIC_FEATURE_SYNC`, DECISIONS D-10.x)

- Every device publishes its full state to public Nostr relays, sealed with AES-GCM-256 under the household data key (AAD = household id). Relays never receive a key or plaintext.
- Events are signed with a secp256k1 key derived from the household key (HKDF-SHA-256). That signature only lets relays index the events; it is not a security boundary. A narrow exception to "Web Crypto only" (D5): signing uses `@noble/curves`.
- Invites: a 10-character family code (50 bits; also in the QR code and link) derives, via PBKDF2-SHA-256 (200 000 iterations) and HKDF, the key that seals the household key and member list on the relays; invitations expire after 15 minutes. **Anyone who has an unexpired family code can join — share it only with your own family.**
- Relays see metadata: the household's public key, timing, sizes, device ids and IP addresses.
- A removed device keeps the household key (no key rotation in this version).

## LAN pairing

- Devices pair by exchanging two QR codes (or the same text by hand). There is no signalling server, relay or account. WebRTC uses no STUN/TURN servers, so only devices on the same local network can connect.
- Both screens show a 6-digit check code derived from the pairing secret. If the numbers differ, someone substituted a code: cancel the pairing.
- Plaintext never crosses the DataChannel: the handshake is sealed under the pairing key and every record under the household data key.
- Anyone who completes a pairing gets the whole household vault. Pair only devices you control.

## Reporting a vulnerability

Open a private security advisory on the repository rather than a public issue.
