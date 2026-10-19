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
