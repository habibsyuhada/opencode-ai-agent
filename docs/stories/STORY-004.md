# STORY-004 — Shared Package Setup
Status: Ready

## Requirement IDs
- FR-001 [Monorepo Setup]
- AC-001

## Acceptance Criteria IDs
- AC-001: The monorepo structure is established and builds successfully.

## Business Context
To maintain consistency between the client and server, we need a shared package for common types, enums, and utility functions.

## Technical Context
Setting up the `shared` package to export TypeScript types that will be consumed by both `server` and `ui`.

## Scope
- In `packages/shared`, configure a basic TypeScript project.
- Create initial placeholder types/enums (e.g., `AgentRole`, `TaskStatus`).
- Configure `package.json` exports correctly so other packages can import from it.

## Out of Scope
- Defining the complete data model (that comes with Prisma).

## Files Likely Affected
- `/packages/shared/package.json`
- `/packages/shared/tsconfig.json` (new)
- `/packages/shared/src/index.ts` (new)
- `/packages/shared/src/types/index.ts` (new)
- `/packages/shared/src/enums/index.ts` (new)

## Implementation Notes
- Ensure `main` and `types` fields in `package.json` are set correctly.
- Add `packages/shared` as a dependency in `packages/server` and `packages/ui` `package.json` files.

## Test Requirements
- Import a shared enum into `packages/server/src/index.ts` and `packages/ui/src/App.tsx` and verify no TypeScript errors occur during build.

## Edge Cases
- TypeScript resolution issues in monorepos can be tricky; ensure path mapping or proper dependency linking is used.

## Dependencies
- STORY-001 (Monorepo Foundation Setup)
- STORY-002 (Initial UI Package Setup)
- STORY-003 (Initial Server Package Setup)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
