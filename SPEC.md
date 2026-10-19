# OmniFamily Nexus — Claude Code Build Specification v2.0

> **How to use this file.** Save it as `SPEC.md` in an empty repo. Open Claude Code in that repo and send:
> `Read SPEC.md. Enter plan mode. Produce a plan for Phase 0 only. Do not write code until I approve the plan.`
> After Phase 0 completes, Claude Code generates `CLAUDE.md` (§11) and every later session starts with `Read SPEC.md and CLAUDE.md. Execute Phase N.`

---

## 0. Mission, Scope and Non-Goals

**Product:** OmniFamily Nexus — an offline-first family calendar, task and chore PWA that replaces Cozi / TimeTree / Skylight.

**Primary differentiator:** zero-account onboarding. The app is usable within 3 seconds of first load, with no email, no password, no OAuth.

**Hard success criteria (v1):**
| # | Criterion | Measurement |
|---|---|---|
| S1 | App fully functional with network disabled | Playwright test with `context.setOffline(true)` passes all CRUD specs |
| S2 | Local write → painted UI | < 50 ms p95, measured with `performance.mark` |
| S3 | Cold start to interactive calendar | < 1.5 s on simulated Moto G4 / Slow 4G (Lighthouse) |
| S4 | Second device joins household via QR | Playwright two-context pairing test passes |
| S5 | Zero network calls required for any core feature | Network panel assertion in e2e test |

**Explicit non-goals for v1 (do not build, do not scaffold):**
N1 cloud accounts or server-side user storage · N2 multi-household / household switching · N3 Web Push and push servers · N4 a sync relay server · N5 ICS/Google/Apple calendar import · N6 voice input · N7 meal planning · N8 payment or subscription logic · N9 native app wrappers.

If a task appears to require a non-goal, **stop and report** (see §10 Stop Conditions).

---

## 1. Resolved Architecture Decisions

These resolve ambiguities present in earlier drafts. Treat each as **settled**. Do not re-litigate; record any deviation in `DECISIONS.md` with a rationale.

**D1 — Rendering model.** Next.js 15 App Router, but the entire product surface is **client components**. **No Server Actions in any core path**, because a Server Action is a network round trip and therefore incompatible with offline-first. The only server code in v1 is one stateless Route Handler, `app/api/intake/route.ts`. The app must boot, render and perform every CRUD operation if that route returns `503`.

**D2 — AI intake.** `/api/intake` is a stateless proxy: receives text/image, returns `ParsedFamilyEntry`, persists nothing, logs nothing. It is **online-only and optional**. Manual entry is always available and is the default path. Bring-your-own-key is out of scope for v1.

**D3 — Pairing transport.** WebRTC DataChannel with **QR-based manual signalling** — no signalling server, consistent with zero-account. Constraints: restrict ICE to **host candidates only** (LAN), compress the SDP (`gzip` → Base45) so it fits a single QR; fall back to an animated multi-frame QR when it does not. Pairing performs a full vault transfer; incremental sync runs over the same channel whenever both devices are online on the same LAN. **This is the highest-risk component — build it last (Phase 6) behind a feature flag, and ship Phases 0–5 as single-device-usable.**

**D4 — Conflict resolution.** Last-Write-Wins is correct for v1 but **wall-clock `updatedAt` is not a valid LWW key** across devices with skewed clocks. Every record carries an **HLC (Hybrid Logical Clock)** string `hlc` used for ordering (Kulkarni et al., 2014); `updatedAt` remains for display only. Deletes are **tombstones**, never hard deletes, with a 90-day sweep. CRDTs (Shapiro et al., 2011) are the documented v2 upgrade path for the grocery list (OR-Set); do not implement them now.

**D5 — Cryptography.** Web Crypto API only; no third-party crypto libraries.
- Household identity: **ECDSA P-256**, private key stored as a **non-extractable `CryptoKey`** in IndexedDB.
- Pairing: **ECDH P-256** → **HKDF-SHA-256** → AES-GCM-256 household data key.
- Sync payloads: **AES-GCM-256**, 96-bit random IV per message, IVs never reused.
- PIN: **PBKDF2-HMAC-SHA-256, ≥ 600 000 iterations**, 16-byte random salt (OWASP, 2024). Exponential backoff after 5 failures; 15-minute local lockout after 10.
- **Stated threat model:** a 4-digit PIN has ~10⁴ entropy and is a *UX speed bump on a shared screen*, not a security boundary. IndexedDB is **not** encrypted at rest in v1; the app relies on OS-level device encryption. Both facts must appear verbatim in `SECURITY.md` and in the onboarding copy.

**D6 — Time.** Store a UTC ISO-8601 instant **plus** a separate IANA `timeZone` field. All-day events store a floating `YYYY-MM-DD` date with no time or zone. Library: `date-fns` + `@date-fns/tz`. Never construct a `Date` from a raw string without an explicit zone.

**D7 — Recurrence.** `rrule` library. Store `rrule` + `exDates: string[]`; overrides are separate records carrying `recurrenceParentId` + `recurrenceId`. Expand **lazily** for the visible window only, hard-capped at 24 months.

**D8 — Notifications.** Local only: Notification API + Service Worker scheduling, with `Periodic Background Sync` as a progressive enhancement where supported. Document that iOS Safari requires an installed PWA and has no Periodic Background Sync. Web Push is a non-goal (N3).

**D9 — Testing.** Vitest + `@testing-library/react` + `fake-indexeddb` for units; Playwright for e2e including an offline spec and a two-browser-context pairing spec; `tsc --noEmit`; ESLint flat config; Prettier. Lighthouse CI budget enforced in CI.

**D10 — i18n.** `next-intl` with `en` and `nl` locales from Phase 1. All user-facing strings go through the catalogue; no hardcoded copy in components.

---

## 2. Technical Stack (pinned)

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 15+ App Router, React 19 | client components only in core paths |
| Language | TypeScript 5.x, `strict: true` | `any` is forbidden; `unknown` + narrowing instead |
| Styling | Tailwind CSS v4 | CSS-first config; verify Shadcn compatibility before adding it |
| UI primitives | Radix UI; Shadcn only where it works on Tailwind v4 | |
| Icons / motion | `lucide-react`, `framer-motion` | motion restricted to ≤ 200 ms transitions |
| Local DB | `dexie` + `dexie-react-hooks` (`useLiveQuery`) | all writes local-first with optimistic render |
| Device state | `zustand` + `persist` | active profile, kiosk params, device config |
| PWA | `@serwist/next` | manifest, SW, Wake Lock |
| Dates | `date-fns`, `@date-fns/tz`, `rrule` | per D6/D7 |
| Package manager | `pnpm` | |

---

## 3. Repository Structure

```
app/
  (app)/layout.tsx            # client shell, profile provider
  (app)/page.tsx              # Today view
  (app)/calendar/page.tsx
  (app)/tasks/page.tsx
  (app)/groceries/page.tsx
  (app)/settings/page.tsx
  kiosk/page.tsx              # wall-display route, own layout
  onboarding/page.tsx
  api/intake/route.ts         # ONLY server code
components/
  ui/                         # Radix/Shadcn primitives
  calendar/ tasks/ groceries/ kiosk/ onboarding/
lib/
  db/schema.ts                # Dexie tables + typed interfaces
  db/migrations.ts            # versioned Dexie upgrades
  db/repositories/*.ts        # ALL db access goes through these
  sync/syncEngine.ts          # outbox, apply, merge
  sync/hlc.ts                 # hybrid logical clock
  sync/transport.webrtc.ts    # D3
  crypto/identity.ts crypto/pairing.ts crypto/pin.ts
  time/ recurrence/ i18n/
stores/                       # zustand slices
tests/unit/  tests/e2e/
SPEC.md  CLAUDE.md  DECISIONS.md  SECURITY.md
```

**Rule:** no React component imports `dexie` directly. Components call repositories; repositories own Dexie and the outbox.

---

## 4. Data Schema (corrected)

Shared fields on every syncable record:

```typescript
export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';

export interface Syncable {
  id: string;            // UUIDv4, generated client-side
  hlc: string;           // hybrid logical clock — the LWW ordering key (D4)
  updatedAt: number;     // epoch ms, DISPLAY ONLY
  deletedAt?: number;    // tombstone marker
  syncStatus: SyncStatus;
}
```

Entities (all extend `Syncable` unless noted):

```typescript
export interface HouseholdContext {            // single row, not syncable
  householdId: string;
  householdName: string;
  deviceId: string;
  isMasterDevice: boolean;
  createdAt: number;
}

export interface Device extends Syncable {     // NEW — device registry
  name: string;
  publicKeyJwk: JsonWebKey;
  lastSeenAt?: number;
  revoked: boolean;
}

export interface FamilyMember extends Syncable {
  name: string;
  colorHex: string;
  avatarBlobId?: string;                       // local Blob, never a remote URL
  role: 'parent' | 'child' | 'guest';
  pinSalt?: string;
  pinHash?: string;                            // PBKDF2 per D5
}

export interface FamilyEvent extends Syncable {
  title: string;
  description?: string;
  startInstant: string;                        // UTC ISO-8601
  endInstant: string;
  timeZone: string;                            // IANA, e.g. "Europe/Amsterdam"
  isAllDay: boolean;
  allDayStartDate?: string;                    // YYYY-MM-DD when isAllDay
  allDayEndDate?: string;
  location?: string;
  memberIds: string[];
  visibility: 'family' | 'private';
  createdById: string;
  rrule?: string;
  exDates?: string[];
  recurrenceParentId?: string;
  recurrenceId?: string;
  linkedTaskIds?: string[];
  linkedGroceryIds?: string[];
}

export interface FamilyTask extends Syncable {
  title: string;
  dueInstant?: string;
  timeZone?: string;
  assigneeId?: string;
  completed: boolean;
  completedAt?: number;
  completedBy?: string;
  pointsValue?: number;
  eventId?: string;
}

export interface GroceryItem extends Syncable {
  name: string;
  category: 'Produce' | 'Dairy' | 'Pantry' | 'Frozen' | 'Household' | 'Other';
  quantity?: string;
  purchased: boolean;
  addedByMemberId: string;
  associatedEventId?: string;
}

export interface PointsLedgerEntry extends Syncable {   // NEW — auditable, not a mutable counter
  memberId: string;
  delta: number;
  reason: 'task_completed' | 'manual_adjustment' | 'reward_redeemed';
  taskId?: string;
}

export interface OutboxEntry {                 // local only, never synced
  seq: number;                                 // ++auto
  entity: 'event' | 'task' | 'grocery' | 'member' | 'device' | 'points';
  recordId: string;
  op: 'insert' | 'update' | 'delete';
  payloadCiphertext: ArrayBuffer;
  createdAt: number;
  attempts: number;
}

export interface ParsedFamilyEntry {           // AI intake payload, not persisted
  title: string;
  startInstant: string;
  endInstant: string;
  timeZone: string;
  isAllDay: boolean;
  location?: string;
  assigneeIds: string[];
  confidenceScore: number;                     // 0–1
  linkedTasks?: Array<{ title: string; assigneeId?: string }>;
  linkedGroceries?: Array<{ item: string; category?: GroceryItem['category'] }>;
  rawContextSnippet?: string;
}
```

**Dexie v1 indexes (declare exactly these):**

```typescript
db.version(1).stores({
  household:   'householdId',
  devices:     'id, revoked, deletedAt',
  members:     'id, role, deletedAt',
  events:      'id, startInstant, recurrenceParentId, syncStatus, deletedAt, *memberIds',
  tasks:       'id, dueInstant, assigneeId, completed, syncStatus, deletedAt',
  groceries:   'id, category, purchased, syncStatus, deletedAt',
  points:      'id, memberId, deletedAt',
  outbox:      '++seq, entity, recordId',
  settings:    'key',
});
```

---

## 5. Sync Protocol

1. Every mutation writes the record **and** an `outbox` row in **one Dexie transaction**. A UI write never awaits the network.
2. HLC: `send()` on every local mutation, `recv(remoteHlc)` on every applied remote op. Format `<48-bit physical ms>:<16-bit counter>:<deviceId>`.
3. Merge rule: compare `hlc` lexicographically; higher wins; ties broken by `deviceId`. **Per record**, except `FamilyTask.completed`, which merges per field so two devices toggling different fields do not clobber each other.
4. Deletes set `deletedAt` + `syncStatus: 'pending_delete'`. Queries always filter `deletedAt === undefined`. A nightly sweep purges tombstones older than 90 days.
5. Every payload leaving the device is AES-GCM encrypted under the household key (D5). Plaintext never crosses the DataChannel.
6. Sync is **idempotent and resumable**: replaying the outbox must converge, and a partial transfer must not corrupt the vault.

---

## 6. Kiosk Mode (`/kiosk`)

- Contrast ≥ 7:1 for all text (WCAG 2.2 AAA, SC 1.4.6); touch targets ≥ 48 × 48 CSS px (SC 2.5.8 minimum is 24 px — exceed it).
- Screen Wake Lock API, re-acquired on `visibilitychange`.
- Burn-in mitigation: 1–2 px layout shift every 5 minutes.
- Auto-return to the overview after 60 s idle; parent actions gated behind the PIN check.
- 60 fps during all transitions; no layout thrash from the clock tick.

---

## 7. Privacy and Compliance (EU / GDPR)

Local-only storage keeps most GDPR surface off the table, but **the AI intake path sends household data — including children's data — off-device**, so:
1. Opt-in consent gate before the first `/api/intake` call, in plain language, revocable in Settings.
2. Data minimisation: send only the raw snippet the user submitted; strip member names before transmission where parsing allows, and re-attach locally.
3. Zero retention server-side; state it in `PRIVACY.md` and in the consent dialog.
4. A working **Export vault** (JSON) and **Delete everything** (clears IndexedDB, Cache Storage and keys) in Settings.
Reference: Regulation (EU) 2016/679, Arts. 5, 6, 8, 13, 17, 25.

---

## 8. Build Phases (one phase per Claude Code session)

Each phase ends with `pnpm typecheck && pnpm lint && pnpm test` green and a commit. **Do not start phase N+1 in the same session as phase N.**

| Phase | Deliverable | Acceptance test |
|---|---|---|
| **0** | Repo bootstrap: Next.js 15, TS strict, Tailwind v4, ESLint/Prettier, Vitest, Playwright, pnpm scripts, `CLAUDE.md`, `DECISIONS.md` | `pnpm typecheck && pnpm lint && pnpm test` exits 0 on an empty suite |
| **1** | Dexie schema + repositories + HLC + i18n scaffold | Unit tests: CRUD + tombstones + HLC monotonicity under simulated clock skew |
| **2** | Onboarding: household vault creation, ECDSA keypair, members, PIN set/verify | Test: PIN verify succeeds; wrong PIN backs off; keypair is non-extractable |
| **3** | Calendar UI: month/week/day, create/edit/delete, recurrence, timezone-correct rendering across a DST boundary | Test: event created 2026-10-24 19:00 Europe/Amsterdam still renders 19:00 after the DST shift |
| **4** | Tasks, chores, points ledger, groceries, cross-entity linking | Test: completing a linked task writes a ledger entry and updates the event badge |
| **5** | PWA + Kiosk: Serwist SW, manifest, offline shell, Wake Lock, local notifications, contrast and target-size audit | Playwright offline spec passes; Lighthouse PWA ≥ 95, a11y = 100 |
| **6** | Pairing + sync behind flag `NEXT_PUBLIC_FEATURE_SYNC` | Two-context Playwright test: device B receives device A's vault and a subsequent edit |
| **7** | AI intake + consent gate | Test: with `/api/intake` returning 503, every other feature still works |

---

## 9. Performance Budgets (enforced in CI)

- Main route JS ≤ 200 KB gzip; Kiosk route ≤ 150 KB.
- Local write → paint < 50 ms p95 (Nielsen's 0.1 s "feels instantaneous" threshold; Nielsen, 1993).
- FCP < 1.5 s, TTI < 3.0 s on Lighthouse mobile throttling.
- No `useEffect`-driven data fetching in the render path; `useLiveQuery` only.

---

## 10. Agent Operating Rules (Claude Code)

1. **Plan before coding.** Enter plan mode for every phase; present the plan; wait for approval.
2. **Verify your own work.** After every phase run `pnpm typecheck && pnpm lint && pnpm test`. Never report a phase complete on untested code; paste the actual command output.
3. **Explore before editing** existing files; do not guess at structure.
4. **Small commits.** One commit per acceptance criterion, conventional-commit messages.
5. **No `any`, no `@ts-ignore`, no disabled lint rules** without an inline comment stating the reason.
6. **No new dependency** outside §2 without logging it in `DECISIONS.md` with a one-line justification.
7. **Decide, don't stall.** If something is not covered here, choose the simplest option consistent with §1, implement it, and append it to `DECISIONS.md`. Do not pause to ask.
8. **Do not run a dev server in the foreground.** Use the test suite to verify.
9. **Stop conditions — halt and report instead of proceeding:** (a) the task requires a paid service, an API key or any secret; (b) the task requires a non-goal from §0; (c) the task would weaken the zero-account model or §1 D5 cryptography; (d) a phase acceptance test cannot be made to pass after two genuine attempts.

---

## 11. `CLAUDE.md` to generate in Phase 0

Keep it under ~60 lines; it is loaded into every session.

```markdown
# OmniFamily Nexus

Offline-first family PWA. Full spec in SPEC.md — read it before any non-trivial change.

## Commands
pnpm dev · pnpm build · pnpm typecheck · pnpm lint · pnpm test · pnpm test:e2e

## Non-negotiables
- TypeScript strict. No `any`, no `@ts-ignore`.
- No Server Actions. Only server file is app/api/intake/route.ts.
- Components never import dexie. Use lib/db/repositories/*.
- Every write is local-first + an outbox row in ONE transaction.
- LWW ordering uses `hlc`, never `updatedAt`.
- Deletes are tombstones (`deletedAt`), never hard deletes.
- Times: UTC instant + IANA timeZone. All-day = floating YYYY-MM-DD.
- No user-facing string outside the next-intl catalogue (en, nl).

## Before saying a task is done
Run: pnpm typecheck && pnpm lint && pnpm test — and paste the output.

## When unsure
Pick the simplest option consistent with SPEC.md §1 and log it in DECISIONS.md.
```

---

## 12. Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| QR-only WebRTC signalling may not fit SDP in one code | High | Host-only ICE, gzip+Base45, animated multi-frame fallback; Phase 6 is flagged and non-blocking |
| No relay → devices must share a LAN to sync | High | Documented as a v1 limitation in onboarding copy; relay is a v2 decision |
| Tailwind v4 + Shadcn compatibility | Medium | Verify in Phase 0; fall back to raw Radix + Tailwind |
| iOS PWA limits (no Periodic Background Sync, storage eviction) | Medium | Detect and degrade; warn in Settings; prompt to install |
| 4-digit PIN brute force on a shared device | Medium | Backoff + lockout; disclosed as a speed bump, not security |
| IndexedDB plaintext at rest | Medium | Disclosed in SECURITY.md; relies on OS disk encryption; v2 candidate |

---

## References (APA 7)

European Parliament & Council of the European Union. (2016). Regulation (EU) 2016/679 (General Data Protection Regulation). *Official Journal of the European Union, L119*, 1–88.

Kleppmann, M., Wiggins, A., van Hardenberg, P., & McGranaghan, M. (2019). Local-first software: You own your data, in spite of the cloud. *Proceedings of the 2019 ACM SIGPLAN International Symposium on New Ideas, New Paradigms, and Reflections on Programming and Software (Onward! 2019)*, 154–178. https://doi.org/10.1145/3359591.3359737

Kulkarni, S. S., Demirbas, M., Madappa, D., Avva, B., & Leone, M. (2014). Logical physical clocks. In M. K. Aguilera, L. Querzoni, & M. Shapiro (Eds.), *Principles of distributed systems (OPODIS 2014)* (pp. 17–32). Springer.

Nielsen, J. (1993). *Usability engineering*. Academic Press.

OWASP Foundation. (2024). *Password storage cheat sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. (2011). Conflict-free replicated data types. In X. Défago, F. Petit, & V. Villain (Eds.), *Stabilization, safety, and security of distributed systems (SSS 2011)* (pp. 386–400). Springer.

World Wide Web Consortium. (2023). *Web content accessibility guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/

World Wide Web Consortium. (2017). *Web cryptography API*. https://www.w3.org/TR/WebCryptoAPI/

---

*This specification was generated with AI assistance; errors are common. Verify the facts, DOIs and library compatibility before relying on them.*
