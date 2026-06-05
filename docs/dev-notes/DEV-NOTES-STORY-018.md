# Dev Notes
Story ID: STORY-018

## Story Context Reviewed
- Story: CLI Tools & Local Dev Setup
- Goal: Build CLI tooling to handle setup tasks like database pushing and initial configuration
- Dependencies: STORY-001 (Monorepo Foundation Setup) — completed
- Architecture: Commander-based CLI in `packages/cli`, cross-platform compatible

## Files Changed
- `packages/cli/package.json` — Added dependencies (commander, execa, chalk) and dev dependencies (tsx, vitest, @types/node); added test/dev/build scripts
- `packages/cli/bin/run.js` — Created entry point using tsx loader for TypeScript execution
- `packages/cli/src/index.ts` — Replaced empty export with Commander program setup, exports `createProgram()` and all command functions
- `packages/cli/src/commands/dev.ts` — Created `dev` command implementation (concurrent UI + Server dev servers)
- `packages/cli/src/commands/setup.ts` — Created `setup` command implementation (Prisma generate + DB push + seed)
- `packages/cli/src/commands/migrate.ts` — Created `migrate` command implementation (Prisma migrate)
- `packages/cli/src/utils/project.ts` — Created project path utilities (findMonorepoRoot, getServerDir, getUiDir, getPrismaDir, validateMonorepoStructure)
- `packages/cli/src/utils/runner.ts` — Created process runner utilities (run, runPnpmScript, runConcurrently)
- `packages/cli/src/__tests__/cli.test.ts` — Created 21 tests covering program configuration, project utilities, and command exports
- `packages/cli/vitest.config.ts` — Created vitest configuration for the CLI package

## Implementation Summary
The CLI is built using **Commander.js** for command parsing, **execa** for cross-platform child process execution, and **chalk** for colored output.

### Commands Implemented:
1. **`armiai dev`** — Starts the UI and Server dev servers concurrently using `concurrently` (from root workspace). Supports `--server-only` and `--ui-only` flags.
2. **`armiai setup`** — Runs Prisma client generation, DB push, and database seeding in sequence. Supports `--skip-seed` and `--skip-generate` flags. Seed failure is non-fatal (seed file may not exist yet).
3. **`armiai migrate`** — Runs Prisma client generation and migrations. Supports `-n, --name <name>` for migration naming.

### Architecture Decisions:
- **Monorepo root detection**: `findMonorepoRoot()` walks up from CWD looking for `pnpm-workspace.yaml`, ensuring the CLI works from any subdirectory.
- **Cross-platform support**: Uses `execa` with `shell: true` for Windows/Mac/Linux compatibility. Uses `npx concurrently` for parallel process management.
- **TypeScript at runtime**: The bin entry point uses `tsx/esm` loader to transpile TypeScript on the fly, avoiding a separate build step for development.
- **Delegation pattern**: Commands delegate to the actual workspace scripts via `pnpm --filter`, keeping the CLI as an orchestration layer.

## Tests Added or Updated
- `packages/cli/src/__tests__/cli.test.ts` — 21 tests:
  - **CLI Program** (11 tests): Verifies program name, description, version, all 3 commands registered, and all command options present
  - **Project Utilities** (7 tests): Verifies monorepo root detection, directory path helpers, and structure validation
  - **Command Exports** (3 tests): Verifies all command functions are exported from index.ts

## Test Commands Run
```bash
pnpm --filter @armiai/cli test      # 21 passed
pnpm --filter @armiai/cli typecheck # passed
node packages/cli/bin/run.js --help # correct output
```

## Test Results
- **Vitest**: 21/21 tests passed (620ms)
- **TypeScript**: No type errors
- **CLI Help**: All 3 commands (dev, setup, migrate) display correct help text with options

## Commit Notes
Suggested commit message:
```
feat(cli): implement STORY-018 CLI tools and local dev setup

- Add Commander.js CLI with dev, setup, and migrate commands
- `armiai dev` starts UI and Server concurrently
- `armiai setup` runs Prisma generate + DB push + seed
- `armiai migrate` runs Prisma migrations
- Add project path utilities for monorepo root detection
- Add cross-platform process runner using execa
- Add 21 tests (all passing)
```

## Risks / Limitations
- **Database required**: `setup` and `migrate` commands require a running PostgreSQL instance with `DATABASE_URL` configured in `.env`
- **No seed file yet**: The seed script (`prisma db seed`) will fail gracefully if no seed file exists in the server package — this is expected at this stage
- **concurrently dependency**: The `dev` command relies on `concurrently` being installed at the root workspace (it is, as a devDependency)
- **tsx runtime dependency**: The bin entry requires `tsx` to be installed; it's listed as a devDependency of the CLI package

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
