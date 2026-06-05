# STORY-006 — Prisma Seed Script (Legacy Template Migration)
Status: Ready

## Requirement IDs
- FR-004 [Agent Roles]

## Acceptance Criteria IDs
- AC-002: The database schema correctly supports multi-company isolation and agent hierarchies.

## Business Context
We need to migrate the existing agent configurations from the old CLI prototype into our new database structure so users have starting templates for their AI teams.

## Technical Context
Writing a Prisma seed script that reads the old `old_version/v2/template/.opencode/opencode.json` (or equivalent structure) and inserts these as default `Agent` role templates into the database.

## Scope
- Create `packages/server/prisma/seed.ts`.
- Write logic to parse the legacy JSON template format.
- Insert a default `Company` to own these templates (or mark them as global templates).
- Insert the `Agent` records representing the roles (e.g., Developer, QA).

## Out of Scope
- Actually migrating live user data (this is just for templates).

## Files Likely Affected
- `/packages/server/prisma/seed.ts` (new)
- `/packages/server/package.json` (update seed script)

## Implementation Notes
- You may need to create a dummy `opencode.json` file in the codebase to represent the old structure if it doesn't exist, based on the architecture doc.
- Configure `prisma.seed` in `package.json` to execute this script via `tsx` or `ts-node`.

## Test Requirements
- Running `pnpm prisma db seed` successfully populates the database with the agent templates without errors.

## Edge Cases
- Malformed JSON in the legacy template.

## Dependencies
- STORY-005 (Database Foundation & Prisma Schema)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
