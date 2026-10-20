# Privacy

OmniFamily Nexus stores your family's data **only on your own devices**. There are no accounts and no server-side storage, and nothing is sent anywhere unless you use one of the two features below. Legal basis and references: Regulation (EU) 2016/679 (GDPR), Arts. 5, 6, 8, 13, 17, 20, 25.

## What stays on the device

Calendar events, tasks, chores, points, groceries, family members, PIN hashes, device keys and settings are kept in this browser's IndexedDB. IndexedDB is not encrypted at rest in v1; protect the device with its own encryption and lock screen (see `SECURITY.md`).

## Import dates from messages, photos and spreadsheets

Pasted text, photos and spreadsheet files are read **on this device**: the text recognition engine and its language data are downloaded once from this app's own website and then run in your browser. Nothing you import is uploaded or sent to anyone, and every found date is shown for review before it is saved.

## AI quick add (optional, off by default)

- **Opt-in.** Before the first use the app asks for consent in plain language. You can withdraw it at any time in Settings → Privacy & data; quick add then asks again before it sends anything.
- **What is sent.** Only the text you type into quick add, plus your time zone, language and the current time (to resolve words like "Saturday"). Family members' names are replaced by codes (P1, P2, …) **before** the text leaves the device and are put back locally (data minimisation, Art. 5(1)(c)). Nothing else from your vault is sent.
- **Zero retention.** `/api/intake` is a stateless proxy: it does not store, log or forward your text anywhere other than the AI service that parses it, and it keeps no copy of the result.
- **Children's data.** Entries may concern children. Consent is given by the parent or guardian using the app (Art. 8).
- **Always optional.** Manual entry ("New event") works without it, including offline.
- **v1 status.** No AI provider is configured in this version, so quick add answers "not available" until the operator connects one. When one is connected, its name and its own retention terms must be added here and to the consent dialog before release.

## Sync between your devices (optional)

**Over the internet (default once you add a device).** Each device encrypts the family's data on the device itself (AES-GCM-256 with a key only your devices have) and leaves it on several free public "Nostr" relays. Your other devices pick it up from there. The relays — run by independent volunteers and companies, not by us — store only scrambled data they cannot read. They can see that an anonymous household key exists, when and how much data is sent, and the IP address that sent it. Inviting a device puts an encrypted invitation on the relays for 15 minutes; the key to open it is only in the QR code or link you share. You can switch internet sync off in Settings → Devices; the app then sends nothing.

**On the same Wi-Fi (no internet).** Devices can also pair directly over your local network, encrypted the same way. No server sees anything.

## Your rights on this device

- **Export (Art. 20):** Settings → Privacy & data → _Export vault (JSON)_ downloads everything this device holds, without PIN hashes or keys.
- **Erasure (Art. 17):** Settings → Privacy & data → _Delete everything_ erases the vault (records and keys), cached app files, the service worker and local preferences from this device. Repeat on every paired device.
