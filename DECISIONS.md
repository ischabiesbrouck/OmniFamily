# Decisions Log

Deviations from, and clarifications of, SPEC.md. Newest phase last. Format: **ID — decision.** Rationale.

## Phase 0 — Repo bootstrap (2026-10-19)

**D-0.1 — Pin TypeScript 5.9.3.** npm `latest` is 7.x; SPEC §2 pins 5.x.

**D-0.2 — Pin Next.js 15.5.28 and React 19.3.1.** Latest 15.x line per SPEC §2; Next 16 is not adopted.

**D-0.3 — ESLint 9.39 with `eslint-config-next` via `@eslint/eslintrc` FlatCompat.** `eslint-config-next@15` peers `eslint ^9` and ships legacy (eslintrc) configs; FlatCompat is the documented bridge to a flat config (D9). ESLint 10 is not adopted.

**D-0.4 — Lint enforces SPEC rules mechanically.** `no-explicit-any` and `ban-ts-comment` (`@ts-ignore` banned; `@ts-expect-error` only with a description) are errors; `no-restricted-imports` blocks `dexie` and `dexie-react-hooks` in `app/`, `components/`, `stores/` (SPEC §3); `--report-unused-disable-directives` and `--max-warnings=0` are on.

**D-0.5 — Vitest 5.0.5 on Vite 8.3.4 with jsdom 29.1.1.** `@vitejs/plugin-react@6` requires Vite 8; jsdom 30 requires Node ≥ 22.22.2 and the current runtime is 22.22.0. `engines.node` is set to `>=22.13.0` (jsdom 29 floor).

**D-0.6 — Playwright 1.56.1.** Matches the Chromium build preinstalled in the cloud sandbox (no browser download). `PW_CHROMIUM_PATH` optionally overrides the executable. E2E is not part of the `pnpm test` gate; it builds and serves the production app.

**D-0.7 — Shadcn verified compatible with Tailwind v4, not installed yet.** The shadcn CLI v4 supports Tailwind v4 (SPEC §12 risk closed). Primitives will be added in the phase that first needs them, keeping Phase 0 minimal.

**D-0.8 — Placeholder heading on `app/page.tsx` is hardcoded.** Temporary exception to D10; it moves into the next-intl catalogue in Phase 1.

**D-0.9 — `exactOptionalPropertyTypes` left off; `noUncheckedIndexedAccess` and `noImplicitOverride` on.** Optional SPEC §4 fields are assigned `undefined` routinely by Dexie updates; the other two flags add safety at no friction.

**D-0.10 — CI gate (`.github/workflows/ci.yml`) runs typecheck, lint, format check, unit tests and build.** Lighthouse CI and bundle-size budgets (SPEC §9) are deferred to Phase 5, when there is a PWA shell to measure.

### Dev dependencies added outside SPEC §2 (SPEC §10.6)

| Package                                             | Justification                                                 |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `@eslint/eslintrc`                                  | FlatCompat bridge for `eslint-config-next@15` (D-0.3).        |
| `eslint-config-next`                                | Next.js lint rules (core-web-vitals, typescript).             |
| `eslint-config-prettier`                            | Turns off stylistic ESLint rules that conflict with Prettier. |
| `prettier-plugin-tailwindcss`                       | Deterministic Tailwind class ordering.                        |
| `@tailwindcss/postcss`                              | Required PostCSS integration for Tailwind v4 in Next.js.      |
| `vite`, `@vitejs/plugin-react`                      | Vitest peer and JSX transform for component tests.            |
| `jsdom`                                             | DOM environment for Vitest component tests.                   |
| `@testing-library/dom`, `@testing-library/jest-dom` | Peer of `@testing-library/react`; DOM matchers.               |
| `@types/node`, `@types/react`, `@types/react-dom`   | Type definitions for strict TypeScript.                       |

## Process

**D-P.1 — Several phases run in one session.** On 2026-10-19 the owner replied "Build" after Phase 0, explicitly asking to continue. SPEC §8 ("one phase per session") and §10.1 (plan approval per phase) are waived for this run; each phase still ends with a green gate and its own commits.

## Phase 1 — Data layer, HLC, i18n (2026-10-19)

**D-1.1 — HLC wire format uses zero-padded hex: `<12 hex pt>:<4 hex counter>:<deviceId>`.** Fixed width makes SPEC §5.3 "compare lexicographically" correct; deviceId is the final segment, so ties break by deviceId for free. A counter overflow borrows the next millisecond; remote timestamps more than 24 h ahead throw `HlcDriftError` instead of dragging the clock forward.

**D-1.2 — HLC state is persisted in `settings` and re-read inside every write transaction.** Guarantees monotonicity across reloads (wall clock regressions) and across tabs sharing one IndexedDB.

**D-1.3 — Outbox `payloadCiphertext` holds the UTF-8 JSON snapshot in Phase 1; encryption happens at the transport boundary (Phase 6).** Web Crypto is asynchronous and cannot be awaited inside an IndexedDB transaction without it auto-committing, which would break SPEC §5.1 atomicity. The outbox never leaves the device and IndexedDB is plaintext at rest by design (D5), so this does not weaken the threat model; SPEC §5.5 (nothing leaves the device unencrypted) remains enforced in the sync engine.

**D-1.4 — Boolean indexes (`completed`, `purchased`, `revoked`) are declared as SPEC §4 requires but are inert.** IndexedDB cannot index booleans; queries on these fields use `.filter()`. Changing to 0/1 would need a schema migration; revisit only if a query proves slow.

**D-1.5 — Syncable tables use `Table<T, string>` (not `EntityTable`).** IDs are always generated client-side, so the insert type never omits `id`.

**D-1.6 — All writes go through `RepositoryCore.write(entities, fn)`.** It opens one `rw` transaction over the declared tables + `outbox` + `settings`, stamps each mutation with `clock.send()`, and lets callers write several entities atomically (needed by Phase 4's task → ledger flow). Touching an undeclared table throws.

**D-1.7 — `syncStatus` stays `pending_insert` when a never-synced record is updated.** The peer has never seen it, so it must still be inserted.

**D-1.8 — Tombstone sweep (`maybeSweepTombstones`) runs at most once per 24 h, triggered from the app shell, not a timer.** "Nightly" is not achievable reliably in a PWA without background execution; it also deletes the purged records' outbox rows.

**D-1.9 — next-intl runs client-only via `NextIntlClientProvider` without the Next.js plugin or locale routing.** No middleware or server rendering per locale (D1); both catalogues are bundled so localisation works offline. Locale comes from `navigator.languages` via `useSyncExternalStore` (server snapshot `en`, so prerendered HTML is English and switches after hydration). A user-chosen override arrives with the Settings page.

**D-1.10 — `react/jsx-no-literals` is an error in `app/` and `components/`.** Mechanically enforces D10; D-0.8's placeholder exception is closed.

### Dependencies added in Phase 1

| Package                | Justification                           |
| ---------------------- | --------------------------------------- |
| `fake-indexeddb` (dev) | Listed in D9; IndexedDB for unit tests. |

## Phase 2 — Onboarding, identity, PIN (2026-10-20)

**D-2.1 — The device identity `CryptoKeyPair` lives in `settings` under `deviceIdentity`.** SPEC §4 declares no key table; `settings` is device-local and never synced. It is written in the same transaction as the household, device and members.

**D-2.2 — Device record id = `deviceId` = the HLC device id.** One identifier per device across the registry, the household context and every timestamp.

**D-2.3 — PIN hashes are self-describing: `pbkdf2-sha256$<iterations>$<base64>`.** The cost can be raised later without a schema change. Tests pass a lower iteration count for speed; one test asserts the production default is 600 000.

**D-2.4 — PINs are 4–8 digits.** SPEC talks about 4-digit PINs; allowing up to 8 lets families choose more entropy at no UX cost.

**D-2.5 — Throttling stays strict after a lockout.** The failure counter keeps accumulating until a correct PIN, so every failure after the 10th re-locks for 15 minutes. Throttled attempts are rejected before PBKDF2 runs. Counters live in `settings` (`pinAttempts:<memberId>`) and are never synced.

**D-2.6 — Onboarding is one screen with a single required field (your name).** This meets the "usable within 3 seconds" differentiator. Family name, device name, PIN and other members are optional or prefilled.

**D-2.7 — Settings is gated by a parent PIN only when at least one parent has one.** If it was open when you arrived, it stays open for that visit (so setting your own PIN does not lock you out); leaving the page locks it again.

**D-2.8 — Active profile and locale override live in a `zustand` + `persist` store (`localStorage`).** As SPEC §2 requires. zustand's server snapshot is the pre-hydration state, so prerendered HTML hydrates without mismatches.

**D-2.9 — Own minimal UI primitives (`components/ui`), no Shadcn yet.** Button, TextField and Select are a few lines each on Tailwind v4; every target is ≥ 48 px and every text token is ≥ 7:1, checked by a unit test.

**D-2.10 — `SECURITY.md` carries the D5 threat-model sentences verbatim; onboarding shows them (with sentence-case capitalisation) in both locales.**

## Phase 3 — Calendar (2026-10-20)

**D-3.1 — Recurrence is expanded in "floating" wall-clock time.** The series' first start is converted to its own IANA zone's wall clock, encoded as a UTC `Date` for `rrule` (no `tzid`), expanded, then each occurrence is converted back through `@date-fns/tz`. Weekly 19:00 Amsterdam therefore stays 19:00 across DST (acceptance test, unit + e2e). Times in a spring-forward gap move forward (TZDate behaviour).

**D-3.2 — `rrule` stores only the RRULE body (e.g. `FREQ=WEEKLY`); DTSTART is the event's `startInstant` + `timeZone`.** No duplicated source of truth.

**D-3.3 — `recurrenceId` and `exDates` hold the occurrence's original start as a UTC ISO instant.** All-day series use `<YYYY-MM-DD>T00:00:00.000Z` as an opaque key.

**D-3.4 — All-day events: `allDayEndDate` is inclusive; `startInstant`/`endInstant` are sort keys only** (`<start>T00:00Z`, `<end+1>T00:00Z`). The floating dates are authoritative and are placed on the viewer's local days.

**D-3.5 — Expansion caps: a window is clipped to 24 months and a series to 1 000 occurrences per window.** Satisfies D7's "hard-capped at 24 months" and bounds the work of a DAILY rule.

**D-3.6 — Private events show only to their creator and the members involved, judged by the device's active profile.** Without an active profile, only family-visible events show.

**D-3.7 — Editing "all occurrences" from any occurrence keeps the series' first date** and applies the new times, duration and fields. Editing "this occurrence" writes an override record; deleting it adds an exDate (and tombstones the override, if any). Deleting the series tombstones the master and every override.

**D-3.8 — Week view is an agenda grid of 7 day columns, not an hourly time grid.** It is simpler, readable on a wall display and enough for v1.

**D-3.9 — Calendar view and date live in the URL (`?view=week&date=2026-10-24`).** This makes views linkable and testable; the page wraps `useSearchParams` in `<Suspense>` for static prerendering.

**D-3.10 — Formatting uses the browser's full locale tag in the chosen language (e.g. `en-GB`, `nl-BE`).** Catalogues stay `en`/`nl`, but dates and times follow regional conventions (24-hour clock in en-GB). The `Locale` augmentation was removed from next-intl's `AppConfig` for this reason.

**D-3.11 — Bundle watch.** `/` and `/calendar` are at ~186–188 kB first-load JS against the 200 kB budget (SPEC §9). Phase 5 enforces the budget in CI and lazy-loads the event dialog (Radix Dialog + form) if needed.

### Dependencies added in Phase 3

| Package                  | Justification                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `@radix-ui/react-dialog` | Accessible modal (focus trap, Escape, aria) for the event editor; Radix is in SPEC §2. |
| `lucide-react`           | Icons, listed in SPEC §2.                                                              |

## Phase 4 — Tasks, points, groceries, linking (2026-10-20)

**D-4.1 — The points ledger is append-only.** Completing a task with points inserts a `task_completed` entry for the assignee (or, if the task is unassigned, whoever ticked it), in the same transaction as the task update. Reopening inserts a reversal with the same reason and a negative delta; repeat completions are no-ops. Balances are always the sum of entries.

**D-4.2 — A date-only due date is stored as 23:59 on that day in the task's zone** (`dueInstant` + `timeZone`, per D6).

**D-4.3 — `FamilyTask.eventId` / `GroceryItem.associatedEventId` are the source of truth for links; `FamilyEvent.linkedTaskIds` / `linkedGroceryIds` are kept in step in the same transaction.** Tasks for a recurring event link to the series master, so the badge shows on every occurrence.

**D-4.4 — "Chores" are tasks with points; no separate entity and no recurring tasks in v1.** SPEC §4 has no recurrence fields on `FamilyTask`; recurring chores are a v2 candidate.

**D-4.5 — Toggles paint optimistically (`useOptimisticToggle`).** The checkbox shows the new state at once and hands back to the live IndexedDB value when it catches up; a failed write rolls back. This meets §2's "optimistic render" and S2.

**D-4.6 — "Clear ticked items" tombstones purchased groceries;** the 90-day sweep purges them later (§5.4).

**D-4.7 — Prettier's Tailwind plugin reads `app/globals.css` (`tailwindStylesheet`)** so v4 theme classes sort correctly.

## Phase 5 — PWA and kiosk (2026-10-20)

**D-5.1 — "Lighthouse PWA ≥ 95" is replaced by explicit checks.** Lighthouse removed its PWA category in v12 (2024), so the score no longer exists. `tests/e2e/offline.spec.ts` asserts what the category used to check: a valid manifest (`standalone`, start URL, `any` + `maskable` icons that load), a service worker whose scope is `/` and which controls the start URL, and full offline operation. `pnpm lighthouse` enforces accessibility = 100, FCP < 1.5 s and TTI < 3.0 s on `/onboarding` and `/kiosk`.

**D-5.2 — Every page is precached by path.** `next.config.ts` adds all routes (and the manifest) to Serwist's precache with a per-build revision. The service worker ignores every query parameter except `_rsc` when matching, so `/calendar?view=day&date=…` opens offline, while React Server Component fetches still go to the network; offline, Next.js falls back to a document navigation that the precache answers. `reloadOnOnline` is off so a reconnect never discards a half-filled form.

**D-5.3 — S5 is asserted, not assumed.** The offline spec fails if any response not served by the service worker reaches the page, or any request other than an optional `_rsc` fetch fails.

**D-5.4 — Reminders: the page polls every 30 s; the service worker polls via Periodic Background Sync where supported.** Both call `claimDueReminders`, which reads due occurrences and marks them notified in one IndexedDB transaction, so a reminder is never shown twice. Reminders cover timed, family-visible events 15 minutes ahead. The on/off flag lives in IndexedDB (the worker cannot read `localStorage`). The iOS limitation (installed PWA only, no background sync) is stated in Settings, per D8.

**D-5.5 — The kiosk is split for its 150 kB budget.** The shell (clock, Wake Lock, burn-in shift, idle timer) is in the initial bundle; the data panels (Dexie, recurrence, tasks) load with `next/dynamic` straight after, from the service-worker cache. The event dialog on the main routes is also lazy. `pnpm budget` enforces §9 in CI (gzip of each route's initial JS from `.next/app-build-manifest.json`).

**D-5.6 — Burn-in mitigation uses `transform: translate()` in an 8-step 0–2 px cycle every 5 minutes.** A transform moves pixels without triggering layout, so it costs nothing on the 60 fps budget. The clock re-renders exactly at minute boundaries with `tabular-nums`, so it never shifts the layout.

**D-5.7 — Kiosk rules: only family-visible events show; anyone may tick chores; nobody can delete there; leaving goes through `ParentGate` (parent PIN); 60 s idle closes the exit prompt and scrolls to the top.**

**D-5.8 — `framer-motion` is not used.** CSS transitions ≤ 200 ms cover v1 and keep it out of the bundle. It remains allowed by §2 if a later screen needs it.

**D-5.9 — Accessibility is enforced in e2e with axe-core** (WCAG 2.2 A/AA plus the AAA 7:1 contrast rule) and a custom check that every visible target is ≥ 48 × 48 px, on every screen including the kiosk and the event dialog. Checkbox hit areas are `<label>`s so the whole 48 px area toggles.

**D-5.10 — Icons are drawn once as SVG and rendered to PNG with Playwright's Chromium (`pnpm icons`)** — no image-processing dependency.

**D-5.11 — S3 note.** Lighthouse measures FCP ≈ 0.8 s and TTI ≈ 2.2–2.6 s under mobile throttling. That meets §9 (FCP < 1.5 s, TTI < 3 s). S3's "< 1.5 s to interactive calendar" is met for first paint but not for TTI; closing that gap needs the main routes to load less JavaScript up front (deferring Dexie behind the first paint, as on the kiosk). This is tracked, not hidden.

### Dependencies added in Phase 5

| Package                               | Justification                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `@serwist/next`, `serwist`            | Listed in SPEC §2 (service worker, precache).                                                                                      |
| `@axe-core/playwright` (dev)          | Automated WCAG audit of every screen in e2e.                                                                                       |
| `lighthouse`, `chrome-launcher` (dev) | Lighthouse CI budget (SPEC D9 / §9); `chrome-launcher` is Lighthouse's own launcher, made explicit because pnpm does not hoist it. |

## Phase 6 — Pairing and sync, behind `NEXT_PUBLIC_FEATURE_SYNC` (2026-10-20)

**D-6.1 — Household data key (HDK).** A random AES-GCM-256 key is created with the household (and lazily for older vaults). It encrypts every sync message (AAD = household id). Pairing runs ephemeral ECDH P-256 → HKDF-SHA-256 (salt = SHA-256 of both public keys) → an AES-GCM-256 _pairing key_. The pairing key protects the handshake and hands the HDK to the joining device. The HDK is extractable only so it can be handed over; IndexedDB is plaintext at rest by design (D5).

**D-6.2 — The QR exchange is the trust anchor, backed by a check code.** Both devices show a 6-digit code derived from the ECDH secret (HKDF, separate `info`) and keep it on screen until the person continues. A substituted QR code yields different numbers. No signatures are needed for v1; device identities (ECDSA) are registered for future revocation.

**D-6.3 — Sync is a full state exchange on every connect, then live deltas.** Each side sends all records (tombstones included) in batches of 100, sealed under the HDK; the receiver merges each record by LWW on `hlc` in one transaction per batch and acknowledges. After that, new outbox rows are streamed as the record's current state; acknowledged outbox rows are deleted and the records marked `synced`. Re-sending everything makes the protocol idempotent and resumable (§5.6), and correct for any number of devices without per-peer watermarks; for a family-sized vault it is a few hundred kB over the LAN. Remote applies never write outbox rows, so nothing echoes.

**D-6.4 — Two schema additions on `FamilyTask` (no Dexie version bump; not indexed):** `completedHlc` (the completion fields merge as one group on this per-field clock, §5.3) and `completionGen` (bumped on each toggle). Completion ledger entries use the deterministic id `<taskId>:<generation>`, so the same chore completed on two devices while apart merges into one entry instead of paying out twice. _Known limitation:_ if one device reopens and another, with a later clock, re-completes from the same generation, the task ends completed while the ledger nets zero; a parent can correct it with a manual adjustment. An OR-Set/CRDT ledger is the v2 path (D4).

**D-6.5 — Transport: WebRTC DataChannel, `iceServers: []`, host candidates only (others are also stripped from the SDP).** Chrome's mDNS host-name obfuscation stays on; the two-context e2e test passes with it. The offer and answer fit a single QR (~1 kB of Base45, ≈ version 20 at ECC M). Payloads over 900 characters split into an animated multi-frame QR, reassembled in any order. A copy/paste text code is the fallback where there is no camera; it is also what the e2e test uses.

**D-6.6 — Scanning uses `BarcodeDetector` where available, otherwise `jsQR` on camera frames** (loaded on demand). QR codes are drawn as SVG from `qrcode-generator`.

**D-6.7 — The live session lives in a non-persisted zustand store** and survives client-side navigation. A full reload closes the DataChannel; reconnecting means a new QR exchange, because without a signalling server there is no way back to the peer. Devices therefore sync whenever someone pairs them on the same LAN — the v1 limitation stated in SPEC §12 and in the Devices copy.

**D-6.8 — A remote clock more than 24 h ahead does not advance ours** (`HlcDriftError` is caught); its records still merge.

**D-6.9 — With the flag off, no sync code ships.** `next.config.ts` always defines `NEXT_PUBLIC_FEATURE_SYNC` (`'true'`/`'false'`), and each call site checks `process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'` inline around its `next/dynamic` import, so webpack folds the constant and drops the dead `import()`. (An imported `SYNC_ENABLED` constant was not enough: webpack still emitted the lazy chunk.) Verified: a flag-off build contains no WebRTC or pairing code. The household-key helpers live in `lib/crypto/householdKey.ts`, so household creation does not pull in pairing code. The e2e build turns the flag on.

### Dependencies added in Phase 6

| Package            | Justification                                                                       |
| ------------------ | ----------------------------------------------------------------------------------- |
| `qrcode-generator` | Draws the pairing QR (MIT, no dependencies); loaded only on the pairing screens.    |
| `jsqr`             | QR decoding where `BarcodeDetector` is missing (Firefox, Safari); loaded on demand. |

## Phase 7 — AI intake and consent (2026-10-20)

**D-7.1 — STOP CONDITION §10.9(a): no AI provider is implemented.** A working intake needs a paid LLM service and an API key; choosing them is the owner's decision. `lib/intake/provider.ts#getIntakeProvider()` returns `null`, so `/api/intake` answers `503 intake_unavailable` — which is exactly the Phase 7 acceptance scenario, verified against the real route in e2e. Adding a provider means implementing `IntakeProvider.parse()` (send the anonymised request, return JSON) and naming the provider and its retention terms in `PRIVACY.md` and the consent dialog.

**D-7.2 — `/api/intake` is a pure function of its request** (`lib/intake/handler.ts`): body size limit, strict input validation, a 20 s provider timeout, and strict validation of the provider's answer (an invalid answer becomes 502, never reaches the client). There is no storage and no logging; `no-console` is an ESLint error for the route and handler, and a unit test spies on `console`. `Cache-Control: no-store`.

**D-7.3 — The quick-add UI ships behind `NEXT_PUBLIC_FEATURE_INTAKE` (default off),** guarded like the sync flag (D-6.9), so the feature appears only once a provider exists. No request is ever made automatically, so S5 and the offline spec are unaffected. Manual "New event" stays the default and works offline.

**D-7.4 — Consent is opt-in, device-local and versioned** (`settings.intakeConsent = { version, grantedAt }`). It is asked before the first call; declining sends nothing. It can be withdrawn in Settings → Privacy & data, and bumping `CONSENT_VERSION` asks again. The dialog covers what is sent, zero retention, children's data (Art. 8) and how to withdraw.

**D-7.5 — Data minimisation:** member names are replaced, whole word, case-insensitive and longest first, by tokens P1, P2, … numbered only for names that occur (so the tokens reveal nothing about family size). The provider sees only tokens; titles, locations and assignees are mapped back on the device. An e2e test asserts the outgoing body contains no name.

**D-7.6 — Parsed entries are always reviewed before saving.** "Add" creates the event plus the ticked linked tasks and groceries; "Edit first" opens the normal event dialog prefilled (linked suggestions are then skipped); low confidence (< 0.6) shows a warning.

**D-7.7 — Export and erasure (§7.4) are in Settings → Privacy & data, behind the parent gate.** The export is JSON of every live record without PIN hashes, salts, identity keys or the household key. "Delete everything" deletes the IndexedDB database (records, keys, settings), all Cache Storage, the service worker registration and local/session storage, then reopens onboarding.

**D-7.8 — E2E robustness.** Pages are static HTML hydrated by React; interacting before hydration races React's event replay. The app sets `<html data-hydrated>` after hydration and a shared fixture (`tests/e2e/fixtures.ts`) makes every `goto`/`reload` wait for it. Tests also wait for a write to show up before a full navigation, because unloading the page aborts an uncommitted IndexedDB transaction. The per-test timeout is 60 s, and CI runs 2 workers.

### Dependencies added in Phase 7

None.

## Public demo on GitHub Pages (2026-10-20)

**D-8.1 — A static export of the app is deployed to GitHub Pages** (`.github/workflows/pages.yml`, default branch only), at `https://ischabiesbrouck.github.io/OmniFamily/`. `NEXT_OUTPUT=export` switches `next.config.ts` to `output: 'export'`. Pages has no server, so the workflow removes `app/api` before building; that is harmless because the intake route is dormant (D-7.1) and its UI flag is off. Production hosting with the route still uses `next start`.

**D-8.2 — `NEXT_PUBLIC_BASE_PATH` (`/OmniFamily` on Pages, empty elsewhere) sets Next's `basePath`.** URLs that Next does not prefix itself — manifest fields, metadata icons, `window.location`, the intake endpoint — go through `withBase()`; service-worker URLs derive from `registration.scope`.

**D-8.3 — The Pages build uses `trailingSlash: true`.** The service worker's scope is `/OmniFamily/`, and scope matching is a plain prefix test, so the bare `/OmniFamily` (where `router.replace('/')` lands without the option) would be outside it: the page was never claimed and did not work offline. Widening the scope would need a `Service-Worker-Allowed` header, which Pages cannot send. Precache URLs follow the same slashes. Verified locally with a server that mimics Pages (directory redirects, `404.html`): onboarding, calendar, service-worker control and offline navigation all work.

**D-8.4 — Every visitor's data stays in their own browser.** The public site is the same zero-account, local-only app; nothing a visitor enters is visible to anyone else.

**D-8.5 — Add-forms clear their fields immediately and restore them only if the write fails** (groceries, tasks, members). They used to clear after the IndexedDB write resolved, which wiped anything typed in the meantime (found by an intermittent e2e failure).

## Phase 9 — Import, redesign, everything on (2026-10-20)

Owner's request: "turn on all options as easy as possible but sturdy and working and also free; add date extraction by photo, copied text messages and xlsx and similar files; professionalise UI/UX and responsiveness."

**D-9.1 — Date extraction runs on the device, not through `/api/intake`.** "Free" rules out a paid LLM (D-7.1 still applies), and on-device parsing is also private, offline-capable and needs no consent dialog (nothing leaves the device). `chrono-node` (MIT) parses English and Dutch; both parsers run per line and the one recognising the most text wins. Day-first dates everywhere except `en-US`. Only results that pin a day or weekday count ("next week" is dropped); wrapped lines ("…24 October" / "2026 at 10:00") are re-joined. The AI route and its consent gate remain for a future provider.

**D-9.2 — Spreadsheets:** `.xlsx` via `read-excel-file` (MIT), `.csv/.tsv` via `papaparse` (MIT), `.ods` via a small reader on `fflate` + `DOMParser`. Header words (en + nl: Date/Datum, Time/Tijd, What/Wat, Who/Wie, …) map columns; Excel serials, time fractions and ranges like `19:00 - 20:30` are understood; without a header, rows are parsed as text. Legacy `.xls` is not supported: the only free parser (SheetJS on npm, 0.18.5) has unfixed security advisories, and the fixed builds are only on a CDN this project does not use.

**D-9.3 — Photo OCR: `tesseract.js` 7 with self-hosted assets.** `scripts/copy-ocr-assets.mjs` (run before dev/build) copies the worker, the three LSTM WASM cores and the English/Dutch `best_int` language data (~17 MB) into `public/ocr`. Photos are scaled to ≤ 2 000 px first. No CDN is contacted, which matters under GDPR. Tesseract's own IndexedDB cache is disabled so "Delete everything" stays complete.

**D-9.4 — The OCR assets are not precached** (`globPublicPatterns: ['icons/**/*']`): a 17 MB download for every visitor would be unreasonable. The service worker caches them `CacheFirst` (`ocr-assets`) on first use, so photo import works offline afterwards.

**D-9.5 — The public site enables device pairing** (`NEXT_PUBLIC_FEATURE_SYNC` in the Pages workflow). It stays LAN-only, as D3 requires; there is no free relay that this project can operate or test, and adding public STUN/relays would change the privacy model.

**D-9.6 — Every extracted entry goes through a review list** (edit title, date, times, people; untick to skip) before anything is saved, and is then created through the normal event path (outbox, HLC).

**D-9.7 — Design system.** Colour tokens use CSS `light-dark()` (one definition for both themes); every text and background pair is ≥ 7:1 in both themes and borders are ≥ 3:1, checked by `tests/unit/contrast.test.ts`. The theme is System, Light or Dark (stored in the device store) and is applied before first paint by an inline script. The system font stack keeps it native-looking with nothing to download.

**D-9.8 — Responsive shell:** one `<nav>`, which is a bottom tab bar on phones and a sidebar from `lg`, plus a floating "+" with an Add sheet (event, task, groceries, import). The event editor is global (UI store) instead of one per page.

**D-9.9 — Calendar:** week and day use a time grid (wall-clock minutes, so DST days line up) with overlap columns, a now line and tap-to-create on an hour. Phones show the month as dots with the picked day's agenda, and the week as a day list.

**D-9.10 — Touch targets:** 48 px wherever the pointer is coarse; with a precise pointer (mouse), compact controls may go down to WCAG 2.2's 24 px minimum (SC 2.5.8) via Tailwind's `pointer-fine` variant. The wall display stays strictly at 48 px. The e2e audit applies the matching bar and also runs on a Pixel 7 profile (`mobile` project, `@mobile` tag).

**D-9.11 — Chores ticked today stay listed (struck through) on Today and the wall display** instead of disappearing, so a tick gives feedback and can be undone.

**D-9.12 — Toasts are non-interactive status messages** (`role="status"`, click-through), so they never cover controls.

### Dependencies added in Phase 9

| Package                                                                  | Justification                                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `chrono-node`                                                            | Natural-language date parsing (en, nl), on-device.                                        |
| `tesseract.js`, `@tesseract.js-data/eng`, `@tesseract.js-data/nld` (dev) | On-device OCR; the data packages are copied into `public/ocr` at build time.              |
| `read-excel-file`, `papaparse`, `fflate`                                 | `.xlsx`, `.csv/.tsv`, `.ods` reading (fflate is already a dependency of read-excel-file). |
| `@radix-ui/react-tabs`                                                   | Accessible tabs in the import sheet (Radix is in SPEC §2).                                |

## Phase 10 — Internet sync without a server of our own

**D-10.0 — Owner decision overriding N4, D3 and D-9.5.** The owner asked for "simple sync". A LAN-only sync where both phones must have the app open on the same Wi-Fi and swap two QR codes every time is not simple. The owner's request explicitly overrides non-goal N4 (no sync relay). The constraints stay the same: free, zero-account, no server operated by this project, and nothing readable leaves the device. LAN pairing (D3) stays available under "Without internet".

**D-10.1 — Public Nostr relays as an encrypted mailbox.** Sync uses five free public relays, configured in `lib/sync/relay/config.ts` and overridable with `NEXT_PUBLIC_SYNC_RELAYS`. This choice is the free, account-less option that also works when the devices are never online at the same time:

- Nostr relays are many, independent and free, and they store events.
- Only WebSockets are needed, so there is no NAT traversal to solve.

Every event goes to every relay, so a relay that is down or forgets data costs nothing. Internet sync is a **device-local** setting (the `relaySync` row in `settings`, never synced). It switches on automatically on both devices when one invites the other, and can be turned off in Settings → Devices. With it off, the app makes no network requests, as before (S5).

**D-10.2 — Signing: secp256k1 Schnorr via `@noble/curves`, a deliberate, narrow exception to D5 ("Web Crypto only").** Relays accept only BIP-340-signed events, and Web Crypto has no secp256k1.

- **What the signature is for.** It is transport plumbing only: every device derives the same signing key from the household data key (HKDF-SHA-256, Web Crypto), and relays are asked for that author's events.
- **What protects the data.** Confidentiality and integrity still come from AES-GCM-256 under the household key, sealed with Web Crypto (AAD = household id).
- **Library choice.** `@noble/curves` is audited, has no dependencies beyond `@noble/hashes`, and is lazy-loaded only on devices that sync over the internet.

**D-10.3 — The protocol is "each device publishes its full state".**

- **Encoding.** The snapshot is all syncable records, tombstones included, without the local `syncStatus`. It goes through JSON → gzip → AES-GCM and is cut into ≤ 30 000-character chunks. Each chunk is a NIP-78 addressable event (`kind 30078`, `d = of:<deviceId>:<n>`), so a newer snapshot replaces the older one on the relay.
- **Receiving.** A receiver reassembles chunks with the same snapshot id and merges them with the existing `applyRemoteRecords` (LWW on `hlc`, per-field task completion). The same merge code serves LAN and internet sync.
- **Publishing.** A device publishes when the content hash changes (debounced 1.5 s, triggered by outbox rows or by merged remote changes) and republishes every 12 h, in case relays dropped it.
- **Confirmation.** Outbox rows are acknowledged only after every chunk was stored by at least one relay; if no relay stored it, the device retries after 30 s.
- **Why full state.** Full-state publishing is idempotent and resumable (§5.6). It needs no per-peer bookkeeping and converges for any number of devices. For a family-sized vault it is tens of kB.

**D-10.4 — One-scan invites.**

- **Creating.** "Add a device" creates a random 128-bit secret. From it, HKDF derives an author key and an AES-GCM key. The household id, name and data key are sealed under that AES key and published as an event that expires in 15 minutes (NIP-40, and checked by the receiver).
- **Delivering.** The secret travels only in the QR code or link, as `…/onboarding/#join=<code>`. A URL fragment is never sent to a web server, and the app removes it from the address bar right away. The in-app scanner and the paste box accept both invite links and LAN codes.
- **Joining.** When the new device's own record arrives, the inviting device shows "<name> has joined your family." and overwrites the invitation with an empty one (best effort; expiry is the limit).
- **Security.** Whoever holds the link within 15 minutes can join, just as whoever sees the screen could. There is no check code because the secret never touches the relays.

**D-10.5 — Background runner.** `RelaySyncRunner` is mounted in the app shell and on the wall display, behind `NEXT_PUBLIC_FEATURE_SYNC` (as D-6.9). It loads the relay engine on demand. The pool reconnects with exponential backoff (1 s → 60 s), resubscribes and reconnects at once on the browser's `online` event. The status chip shows Synced, Connecting… or Offline · syncs later; a live LAN session takes precedence.

**D-10.6 — Known limits (documented in PRIVACY.md and SECURITY.md).**

- **Metadata.** Relay operators can see the household's random public key, event times and sizes, the device ids in `d` tags and the connecting IP address. They cannot read content.
- **Retention.** Public relays promise no retention. Data lives on the devices, and relays are only a mailbox.
- **Removed devices.** A removed device keeps the household key; key rotation is a v2 item.
- **Untested public relays.** This build environment cannot reach the public relays. Unit tests use an in-memory relay, and the e2e test runs two browsers against a local NIP-01 relay (`tests/e2e/relay-server.mjs`). Behaviour against the public relays is therefore unverified here, and redundancy across five relays is the mitigation.

**D-10.7 — AI with your own key is parked** at the owner's request ("skip ai for now"). D-7.1 still applies.

**D-10.8 — Family codes replace the 128-bit invite secret (owner: "join a family by code").**

- **Format.** A code is 10 characters of Crockford Base32 (50 bits), shown as `ABCDE-12345`. Case, spaces and dashes are ignored, and O/I/L read as 0/1. The QR code and link carry the same code (`#join=ABCDE-12345`).
- **Key derivation.** Keys come from the code through PBKDF2-HMAC-SHA-256 with 200 000 iterations (Web Crypto) and then HKDF: the invitation's author key, its AES-GCM key and its `d` tag. Deriving the `d` tag as well means invitations cannot be picked out on a relay by a fixed tag.
- **Guessing cost.** An offline guess costs 200 000 HMACs. Exhausting 2⁵⁰ codes within the 15-minute lifetime is out of reach.
- **Member list.** The invitation (payload v2) also carries the family's member records. The new device merges them with the normal LWW apply, so it can offer "I am Sem" before the first sync.

**D-10.9 — Each device belongs to one person.**

- **First screen.** Onboarding opens on a choice: "Create a new family" or "Join a family". With sync off, the form shows directly.
- **After joining.** After joining (by code, QR or LAN pairing), the device asks "Who are you?": pick an existing member, or add yourself as a new one (name, role, colour). Adding yourself is an ordinary member write, so it reaches the other devices through sync.
- **Storage.** The choice is the device's `activeMemberId` (per device, never synced). It can be changed later in Settings → "This device is used by".

### Dependencies added in Phase 10

| Package                 | Justification                                                         |
| ----------------------- | --------------------------------------------------------------------- |
| `@noble/curves`         | BIP-340 Schnorr signatures that relays require (D-10.2); lazy-loaded. |
| `ws`, `@types/ws` (dev) | Local NIP-01 relay for the e2e tests.                                 |
