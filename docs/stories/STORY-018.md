# STORY-018 — CLI Tools & Local Dev Setup
Status: Ready

## Requirement IDs
- N/A (Developer Experience / CLI integration)

## Acceptance Criteria IDs
- N/A

## Business Context
To make the platform easy to deploy and develop against locally, we need CLI tooling to handle setup tasks like database pushing and initial configuration.

## Technical Context
Building the `cli` package using a framework like Commander or oclif.

## Scope
- In `packages/cli`, set up a basic Node CLI tool.
- Implement a `dev` command that wraps the monorepo dev servers (e.g., using concurrently or just wrapping `pnpm dev` at the root).
- Implement a `setup` or `migrate` command that orchestrates Prisma DB push and seeding.

## Out of Scope
- Full production deployment orchestration.

## Files Likely Affected
- `/packages/cli/package.json`
- `/packages/cli/src/index.ts` (new)
- `/packages/cli/bin/armi.js` (new)

## Implementation Notes
- Ensure the CLI can find the `.env` files and Prisma schema located in the `server` package.

## Test Requirements
- Running `npx armi dev` (or similar) successfully starts both the UI and Server.

## Edge Cases
- Handling cross-platform terminal execution paths.

## Dependencies
- STORY-001 (Monorepo Foundation Setup)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
