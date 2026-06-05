# Bugfix Notes
Story ID: STORY-018
Bug report: docs/qa/BUG-REPORT-STORY-018.md

## Root Cause

### BUG-018-001: `runConcurrently()` incorrectly builds concurrently arguments (Medium)
The `runConcurrently()` function in `packages/cli/src/utils/runner.ts` used a `for` loop that pushed `--names` and `--prefix-colors` flags for each command. The `concurrently` CLI expects these flags to appear once with comma-separated values (e.g., `--names server,ui`), but the loop produced `--names server ... --names ui`, causing the second value to override the first.

### BUG-018-002: Unused imports in `dev.ts` (Low)
`getServerDir` and `getUiDir` were imported from `../utils/project.js` but never used. The dev command uses `pnpm --filter` with package names rather than file paths.

### BUG-018-003: Hardcoded server path bypasses utility function (Low)
Both `setup.ts` (line 30) and `migrate.ts` (line 29) used a template literal `` `${monorepoRoot}/packages/server` `` instead of the existing `getServerDir(monorepoRoot)` utility. The template literal produces forward-slash paths on Windows, while `path.join()` (used by `getServerDir`) produces platform-correct separators.

### BUG-018-004: `runPnpmScript` exported but never used (Low)
The `runPnpmScript` function was defined and exported in `runner.ts` (lines 62-68) but never called by any command. It was also imported (but unused) in `setup.ts`.

### BUG-018-005: Misleading error message when both `--server-only` and `--ui-only` are passed (Low)
When both conflicting flags were passed, the error message read "No services to start. Use --server-only or --ui-only." — which is confusing because the user already used those flags. The issue is that both were used simultaneously.

## Fix Summary

### BUG-018-001
Replaced the per-command loop with array mapping: `names` is built via `commands.map(c => c.name).join(",")`, and command strings are collected separately. The `concurrentlyArgs` array is then constructed once with single `--names` and `--prefix-colors` flags followed by all quoted command strings.

**Before (broken):**
```typescript
const concurrentlyArgs: string[] = [];
for (const cmd of commands) {
  concurrentlyArgs.push(
    `--names`, cmd.name,
    `--prefix-colors`, `cyan,yellow`,
    `"${cmd.command}"`
  );
}
```

**After (fixed):**
```typescript
const names = commands.map((c) => c.name).join(",");
const cmdStrings = commands.map((c) => `"${c.command}"`);
const concurrentlyArgs = ["--names", names, "--prefix-colors", "cyan,yellow", ...cmdStrings];
```

### BUG-018-002
Removed `getServerDir` and `getUiDir` from the import statement in `dev.ts`.

### BUG-018-003
Replaced hardcoded template literal with `getServerDir(monorepoRoot)` in both `setup.ts` and `migrate.ts`. Added `getServerDir` to their import statements.

### BUG-018-004
Removed the `runPnpmScript` function definition from `runner.ts`. Removed the unused `runPnpmScript` import from `setup.ts`.

### BUG-018-005
Changed the error message from:
`"✗ No services to start. Use --server-only or --ui-only."`
to:
`"✗ Cannot use both --server-only and --ui-only together. Please choose one."`

## Files Changed
- `packages/cli/src/utils/runner.ts` — Fixed `runConcurrently()` arg building, removed dead `runPnpmScript()` function
- `packages/cli/src/commands/dev.ts` — Removed unused imports (`getServerDir`, `getUiDir`), fixed misleading error message
- `packages/cli/src/commands/setup.ts` — Used `getServerDir()` utility, removed unused `runPnpmScript` import
- `packages/cli/src/commands/migrate.ts` — Used `getServerDir()` utility
- `packages/cli/src/__tests__/cli.test.ts` — Added 2 regression tests for `runConcurrently()`

## Tests Added or Updated
- **"should build comma-separated --names flag for multiple commands"** — Verifies that `--names` appears exactly once with comma-separated values and `--prefix-colors` appears exactly once. Both quoted command strings are present.
- **"should handle a single command correctly"** — Verifies single-command case produces correct `--names` value.

## Test Commands Run
```
npx vitest run               # 23/23 passed (501ms)
npx tsc --noEmit             # No type errors
```

## Test Results
- **Vitest**: 23/23 tests passed (501ms) — 21 original + 2 new regression tests
- **TypeScript**: No type errors

## Ready for QA Recheck?
Status: READY_FOR_QA_RECHECK
