# QA Review — Re-Review After Bugfixes
Story ID: STORY-018
Status: PASS
Previous Status: FAIL (original review)
Review Date: 2026-06-05

## Summary
All 5 bugs from the original QA review have been fixed. The blocking bug (BUG-018-001) in `runConcurrently()` is resolved — the function now correctly builds comma-separated `--names` and single `--prefix-colors` flags. Unused imports, hardcoded paths, dead code, and the misleading error message are all addressed. Two regression tests were added. All 23 tests pass and TypeScript compiles cleanly.

## Acceptance Criteria Check

### AC 1: In `packages/cli`, set up a basic Node CLI tool
**Status: PASS** (unchanged from original review)
- `package.json` properly configured with `name: @armiai/cli`, `type: module`, `bin` field
- `bin/run.js` entry point with shebang and tsx/esm loader
- `src/index.ts` uses Commander.js to create and export `createProgram()`
- CLI help output displays all commands and options correctly

### AC 2: Implement a `dev` command that wraps the monorepo dev servers
**Status: PASS** (previously FAIL)
- `src/commands/dev.ts` implements `devCommand()` with `--server-only` and `--ui-only` flags
- Uses `runConcurrently()` to run UI and Server dev servers in parallel
- **BUG-018-001 FIXED**: `runConcurrently()` now correctly builds `--names server,ui` (comma-separated) and `--prefix-colors cyan,yellow` (single flag) instead of repeating flags per command
- **BUG-018-002 FIXED**: Unused imports (`getServerDir`, `getUiDir`) removed from `dev.ts`
- **BUG-018-005 FIXED**: Error message for conflicting flags now reads "Cannot use both --server-only and --ui-only together. Please choose one."

### AC 3: Implement a `setup` or `migrate` command that orchestrates Prisma DB push and seeding
**Status: PASS** (unchanged from original review)
- `src/commands/setup.ts` implements 3-step sequence: Prisma generate → DB push → Seed
- Supports `--skip-seed` and `--skip-generate` flags
- Seed failure is handled gracefully (non-fatal)
- `src/commands/migrate.ts` implements Prisma generate + migration with `-n, --name` option
- All commands validate monorepo structure before execution
- **BUG-018-003 FIXED**: Both files now use `getServerDir(monorepoRoot)` instead of hardcoded template literal

## Test Commands Run
```
cmd /c "npx vitest run"          # 23/23 passed (500ms)
cmd /c "npx tsc --noEmit"        # No type errors
```

## Test Results
- **Vitest**: 23/23 tests passed (500ms) — 21 original + 2 new regression tests
- **TypeScript**: No type errors

### Test Coverage Breakdown
| Category | Tests | Status |
|---|---|---|
| CLI Program configuration | 11 | PASS |
| Project Utilities | 7 | PASS |
| Command Exports | 3 | PASS |
| runConcurrently regression (BUG-018-001) | 2 | PASS |
| **Total** | **23** | **ALL PASS** |

### Regression Tests Added
- **"should build comma-separated --names flag for multiple commands"** — Verifies `--names` appears exactly once with value `server,ui`, `--prefix-colors` appears exactly once, and both quoted command strings are present. Test stdout confirms correct output: `npx concurrently --names server,ui --prefix-colors cyan,yellow "pnpm --filter @armiai/server dev" "pnpm --filter @armiai/ui dev"`
- **"should handle a single command correctly"** — Verifies single-command case produces `--names server` (no comma).

### Test Coverage Gaps (remaining)
- No integration tests for actual command execution behavior (low priority for CLI wrapper)
- No tests for edge cases like passing both `--server-only` and `--ui-only` (the error message is now correct)

## Manual Review

### File-by-file review of changes:

1. **`packages/cli/src/utils/runner.ts`** — BUG-018-001 FIXED, BUG-018-004 FIXED
   - `runConcurrently()` now uses `commands.map((c) => c.name).join(",")` for names and `commands.map((c) => \`"${c.command}"\`)` for command strings
   - Args array built once: `["--names", names, "--prefix-colors", "cyan,yellow", ...cmdStrings]`
   - `runPnpmScript()` function removed (dead code)
   - File reduced from ~96 lines to 80 lines (cleaner)

2. **`packages/cli/src/commands/dev.ts`** — BUG-018-002 FIXED, BUG-018-005 FIXED
   - Line 2: imports reduced to `findMonorepoRoot, validateMonorepoStructure` only
   - Line 47: Error message now reads "Cannot use both --server-only and --ui-only together. Please choose one."

3. **`packages/cli/src/commands/setup.ts`** — BUG-018-003 FIXED
   - Line 2: now imports `getServerDir` from project utilities
   - Line 30: uses `getServerDir(monorepoRoot)` instead of template literal

4. **`packages/cli/src/commands/migrate.ts`** — BUG-018-003 FIXED
   - Line 2: now imports `getServerDir` from project utilities
   - Line 29: uses `getServerDir(monorepoRoot)` instead of template literal

5. **`packages/cli/src/__tests__/cli.test.ts`** — Regression tests added
   - New describe block: "runConcurrently (BUG-018-001 regression)"
   - Mocks `execa` via `vi.hoisted` to avoid spawning real processes
   - Two tests validating the fix for BUG-018-001

## Bug Verification Summary

| Bug ID | Severity | Description | Status |
|---|---|---|---|
| BUG-018-001 | Medium | `runConcurrently` incorrectly builds concurrently args | **FIXED** ✅ |
| BUG-018-002 | Low | Unused imports in `dev.ts` | **FIXED** ✅ |
| BUG-018-003 | Low | Hardcoded server path bypasses utility function | **FIXED** ✅ |
| BUG-018-004 | Low | `runPnpmScript` exported but never used | **FIXED** ✅ |
| BUG-018-005 | Low | Misleading error message when both flags passed | **FIXED** ✅ |

## Edge Cases Checked
- **Both `--server-only` and `--ui-only`**: Error message is now clear and actionable ✅
- **Missing monorepo structure**: Properly detected and reported with missing paths
- **Seed file missing**: Handled gracefully as non-fatal
- **Cross-platform paths**: `getServerDir()` uses `path.join()` for platform-correct separators ✅
- **Single command in `runConcurrently`**: Regression test validates correct behavior ✅
- **Multiple commands in `runConcurrently`**: Regression test validates comma-separated names ✅

## Regression Risk
- **Low**: All changes are within the `packages/cli` package only.
- No changes to existing packages or shared code.
- The CLI package is `private: true` and not published.
- Two new regression tests provide safety net for the most critical fix.
- `runPnpmScript` removal has no impact since it was never called.

## Final Verdict
**PASS** — All 5 bugs from the original review are fixed. The blocking bug (BUG-018-001) in `runConcurrently()` is correctly resolved with comma-separated names. Code quality issues (unused imports, hardcoded paths, dead code, misleading error message) are all addressed. Two regression tests validate the critical fix. All 23 tests pass and TypeScript compiles cleanly. Story is ready for completion.
