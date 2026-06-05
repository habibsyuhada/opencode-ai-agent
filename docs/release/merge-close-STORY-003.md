# Merge/Close Notes — STORY-003
Date: 2026-06-04

## Story Summary
**STORY-003: Server Database Setup with Prisma Schema**

Established the Prisma ORM layer for the ArmiAI platform with a complete PostgreSQL schema covering all 13 domain models.

## What Was Delivered
1. **Prisma packages**: `prisma@6.9.0` (devDep), `@prisma/client@6.9.0` (dep)
2. **`prisma/schema.prisma`**: Complete schema with 13 models — Company, Workspace, Agent, Project, Goal, Task, Heartbeat, Budget, CostEvent, Approval, ActivityEvent, Routine, Secret
3. **`src/db/client.ts`**: Prisma Client singleton with globalThis caching for hot-reload safety
4. **`packages/server/.env`**: DATABASE_URL placeholder
5. **`package.json` scripts**: `db:generate`, `db:push`, `db:migrate`, `db:seed`, `db:studio`

## Key Design Decisions
- **Prisma 6.9.0** chosen over 7.x because v7 removed `datasource.url` support (breaking change requiring adapter-based client configuration)
- **Indexes** added on all foreign keys and status columns per architecture doc performance requirements
- **Secret model** has `@@unique([companyId, name])` to prevent duplicate secret names per company
- **Task model** includes `lockedAt` field for atomic checkout pattern (preventing concurrent agent task conflicts)

## Dependencies Satisfied
- STORY-001 (Monorepo Foundation): Already completed ✅
- STORY-002 (Server Package Setup): Already completed ✅

## Unblocked Stories
This story unblocks:
- Server API route implementation (Agents, Tasks, Heartbeats, etc.)
- Database seed scripts (legacy opencode.json template migration)
- Budget & cost tracking features
- Governance & approval workflows

## Known Limitations
- No running PostgreSQL instance configured (placeholder DATABASE_URL)
- Seed data not included (separate story)
- Prisma 7 migration deferred to future story

## Definition of Done Checklist
- [x] Story context reviewed by Developer
- [x] Code implemented
- [x] Tests written (prisma generate as validation)
- [x] Tests pass locally
- [x] Dev notes created
- [x] Scrum Master completion review passed
- [x] QA review passed
- [x] Story closed

## Final Status
**CLOSED** — Story complete and ready for production merge.
