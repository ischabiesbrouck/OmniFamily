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
