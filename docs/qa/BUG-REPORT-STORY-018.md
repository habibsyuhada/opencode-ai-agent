# Bug Report
Story ID: STORY-018
Status: CLOSED (all bugs fixed — verified 2026-06-05)

## Summary
All 5 bugs have been fixed and verified. The blocking bug (BUG-018-001) in `runConcurrently()` is resolved. Regression tests have been added.

---

## Bug 1: `runConcurrently` incorrectly builds concurrently arguments
**Status: CLOSED** ✅ — Fixed and regression-tested

### Steps to Reproduce
1. Run `node packages/cli/bin/run.js dev` (without `--server-only` or `--ui-only`)
2. Observe the `npx concurrently` command that is executed

### Expected Result
The concurrently command should be:
```
npx concurrently --names server,ui --prefix-colors cyan,yellow "pnpm --filter @armiai/server dev" "pnpm --filter @armiai/ui dev"
```

### Actual Result (BEFORE fix)
```
npx concurrently --names server --prefix-colors cyan,yellow "pnpm --filter @armiai/server dev" --names ui --prefix-colors cyan,yellow "pnpm --filter @armiai/ui dev"
```

### Fix Applied
Replaced per-command loop with array mapping:
```typescript
const names = commands.map((c) => c.name).join(",");
const cmdStrings = commands.map((c) => `"${c.command}"`);
const concurrentlyArgs = ["--names", names, "--prefix-colors", "cyan,yellow", ...cmdStrings];
```

### Verification
- Regression test "should build comma-separated --names flag for multiple commands" passes
- Test stdout confirms: `npx concurrently --names server,ui --prefix-colors cyan,yellow "pnpm --filter @armiai/server dev" "pnpm --filter @armiai/ui dev"`

---

## Bug 2: Unused imports in `dev.ts`
**Status: CLOSED** ✅ — Fixed

### Fix Applied
Removed `getServerDir` and `getUiDir` from import statement in `dev.ts` line 2.

---

## Bug 3: Hardcoded server path bypasses utility function
**Status: CLOSED** ✅ — Fixed

### Fix Applied
Both `setup.ts` (line 30) and `migrate.ts` (line 29) now use `getServerDir(monorepoRoot)` instead of the template literal. `getServerDir` added to their import statements.

---

## Bug 4: `runPnpmScript` exported but never used
**Status: CLOSED** ✅ — Fixed

### Fix Applied
The `runPnpmScript` function was removed from `runner.ts`. No other file references it.

---

## Bug 5: Misleading error message when both `--server-only` and `--ui-only` are passed
**Status: CLOSED** ✅ — Fixed

### Fix Applied
Error message changed from:
"✗ No services to start. Use --server-only or --ui-only."
to:
"✗ Cannot use both --server-only and --ui-only together. Please choose one."
