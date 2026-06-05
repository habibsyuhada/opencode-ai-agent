# Bug Report
Story ID: STORY-001
Status: OPEN

## Summary
Running `pnpm -r typecheck` on the monorepo fails because the `@armiai/shared` package (and potentially others) are missing input files, causing `tsc` to throw an error.

## Steps to Reproduce
1. In the root directory, run `pnpm -r typecheck`

## Expected Result
The typecheck command should pass successfully without errors.

## Actual Result
```
packages/shared typecheck$ tsc --noEmit
packages/shared typecheck: error TS18003: No inputs were found in config file 'C:/laragon/www/opencode-ai-agent/packages/shared/tsconfig.json'. Specified 'include' paths were '["src/**/*"]' and 'exclude' paths were '["C:/laragon/www/opencode-ai-agent/packages/shared/dist"]'.
```

## Evidence
Terminal output showing `[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @armiai/shared@1.0.0 typecheck: tsc --noEmit`.

## Severity
Medium (Blocks CI/Builds)

## Suggested Area to Inspect
- Add a dummy source file (e.g. `packages/shared/src/index.ts`) in each workspace package that includes `src/**/*` in its `tsconfig.json`, or modify `tsconfig.json` to tolerate empty directories.