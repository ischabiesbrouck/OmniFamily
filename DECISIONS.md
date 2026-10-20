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
