# OmniFamily Nexus

**Try it:** https://ischabiesbrouck.github.io/OmniFamily/ — everything you enter stays in your own browser.

An offline-first family calendar, task, chore and grocery app (PWA) with **zero-account onboarding**: type your name and start. All data lives on your devices.

- **Spec:** [`SPEC.md`](SPEC.md) · **Decisions and deviations:** [`DECISIONS.md`](DECISIONS.md) · **Security:** [`SECURITY.md`](SECURITY.md) · **Privacy:** [`PRIVACY.md`](PRIVACY.md) · **Agent guide:** [`CLAUDE.md`](CLAUDE.md)

## Features

- Month, week and day calendar with recurrence; times are DST-correct across time zones
- Tasks and chores with an append-only points ledger, and a grocery list by aisle; tasks and shopping link to events
- A wall-display kiosk (`/kiosk`): Wake Lock, burn-in shift, idle reset, parent-PIN exit
- Installable and fully offline (service worker precache, IndexedDB); local reminders
- English and Dutch
- **Import dates** from a pasted message, a photo (on-device OCR) or a spreadsheet (.xlsx, .ods, .csv): reviewed before saving, nothing uploaded
- Light and dark themes; phone, tablet and desktop layouts
- **Automatic sync between devices**: each device is its own person; join a family by typing its family code or scanning its QR code; end-to-end encrypted, through free public Nostr relays (no account, no server of ours); LAN pairing without internet also available (`NEXT_PUBLIC_FEATURE_SYNC=true`, on in the public demo)
- Optional AI quick add (`NEXT_PUBLIC_FEATURE_INTAKE=true`; needs a provider, see `DECISIONS.md` D-7.1)

## Develop

```bash
pnpm install
pnpm dev                                  # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test  # the gate for every change
pnpm test:e2e                             # Playwright (builds with both flags on)
pnpm build && pnpm budget                 # JS budgets (SPEC §9)
CHROME_PATH=/path/to/chrome pnpm lighthouse
```

Requires Node ≥ 22.13 and pnpm 10.
