# STORY-005 — Database Foundation & Prisma Schema
Status: Ready

## Requirement IDs
- FR-002 [Database]
- AC-002

## Acceptance Criteria IDs
- AC-002: The database schema correctly supports multi-company isolation and agent hierarchies.

## Business Context
The application needs a reliable database to store user data, agent configurations, and task progress. We are moving away from a file-based prototype to a robust relational database.

## Technical Context
We are setting up PostgreSQL using Prisma ORM within the `server` package.

## Scope
- Initialize Prisma in `packages/server`.
- Define the initial `schema.prisma` with the core models defined in the architecture: `Company`, `Workspace`, `Agent`, `Project`, `Goal`, `Task`, `Heartbeat`.
- Include necessary relations (e.g., Agent hierarchy `managerId`, multi-tenant `companyId` on relevant models).
- Create an initial migration.

## Out of Scope
- Implementing the API routes to interact with this data.
- Advanced features like Budgets and Approvals (will be added in later stories).
- Seeding data (separate story).

## Files Likely Affected
- `/packages/server/prisma/schema.prisma` (new)
- `/packages/server/.env` (new)

## Implementation Notes
- Use standard Prisma `User` and `Company` setup for multi-tenancy.
- Ensure the `Agent` model has a self-relation for the reporting structure.
- Tasks need a `lockedAt` field for atomic checkout.

## Test Requirements
- `pnpm prisma format` runs successfully.
- `pnpm prisma migrate dev` creates the database tables successfully against a local PostgreSQL instance.

## Edge Cases
- Handling circular dependencies in self-relations (Prisma handles this, but good to be aware).

## Dependencies
- STORY-003 (Initial Server Package Setup)
- Local PostgreSQL instance running.

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
