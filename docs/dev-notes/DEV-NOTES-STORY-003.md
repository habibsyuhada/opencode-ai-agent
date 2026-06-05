# Dev Notes
Story ID: STORY-003

## Story Context Reviewed
- **Story**: Server Database Setup with Prisma Schema
- **Source**: `docs/stories/STORY-003.md`, `docs/architecture/architecture.md`, `docs/schema/SCHEMA-AND-API.md`
- **Goal**: Set up Prisma ORM with PostgreSQL for the ArmiAI platform, including all 13 data models

## Files Changed
| File | Action | Description |
|---|---|---|
| `packages/server/package.json` | Modified | Added `prisma` (devDep), `@prisma/client` (dep), and `db:*` scripts |
| `packages/server/prisma/schema.prisma` | Created | Full Prisma schema with 13 models |
| `packages/server/.env` | Created | DATABASE_URL placeholder for PostgreSQL |
| `packages/server/src/db/client.ts` | Created | Prisma Client singleton (prevents hot-reload multiplication) |

## Implementation Summary
1. **Installed Prisma**: `prisma@6.9.0` and `@prisma/client@6.9.0` via pnpm (downgraded from 7.x due to breaking changes with `datasource.url`)
2. **Created `prisma/schema.prisma`**: Includes all 13 models matching the architecture spec:
   - Company, Workspace, Agent (self-relation for org chart), Project, Goal, Task (atomic checkout via `lockedAt`), Heartbeat, Budget, CostEvent, Approval, ActivityEvent, Routine, Secret
   - All models have proper `@@index` annotations on foreign keys and status fields for query performance
   - Secret has `@@unique([companyId, name])` constraint
3. **Created `src/db/client.ts`**: Singleton pattern using `globalThis` caching to prevent multiple Prisma Client instances during hot-reload in development
4. **Added db scripts**: `db:generate`, `db:push`, `db:migrate`, `db:seed`, `db:studio`
5. **Created `.env`**: Placeholder `DATABASE_URL` for PostgreSQL

## Tests Added or Updated
- No unit tests added for this infrastructure story
- Validation performed via `prisma generate` (schema syntax + client generation)

## Test Commands Run
```
npx prisma generate
```

## Test Results
```
Prisma schema loaded from prisma\schema.prisma
✔ Generated Prisma Client (v6.9.0) to node_modules in 108ms
```
Result: **PASS** — Schema validates and Prisma Client generates successfully.

## Commit Notes
Suggested commit message:
```
feat(server): set up Prisma ORM with full database schema

- Install prisma@6.9.0 and @prisma/client@6.9.0
- Create prisma/schema.prisma with 13 models: Company, Workspace,
  Agent, Project, Goal, Task, Heartbeat, Budget, CostEvent, Approval,
  ActivityEvent, Routine, Secret
- Add Prisma client singleton at src/db/client.ts
- Add db:* scripts to package.json
- Add .env with DATABASE_URL placeholder
```

## Risks / Limitations
- **DATABASE_URL**: The `.env` file contains a placeholder. A real PostgreSQL instance is required for `prisma db push` / `prisma migrate dev`.
- **Prisma version**: Pinned to v6.9.0 because v7.x removed `datasource.url` support (breaking change requiring adapter-based client). Migration to v7 should be a separate story.
- **No seed data**: Seed file not included in this story (out of scope).

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
