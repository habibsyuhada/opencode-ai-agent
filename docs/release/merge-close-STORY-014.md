# Merge & Close — STORY-014

## Story
STORY-014: Governance: Approval Workflows + Routines & Scheduling

## Status
READY_FOR_MERGE

## Summary of Changes

### New Files (7)
1. `packages/server/src/modules/routines/schema.ts` — Zod schemas for routines
2. `packages/server/src/modules/routines/service.ts` — Routines business logic
3. `packages/server/src/modules/routines/routes.ts` — Hono REST endpoints
4. `packages/server/src/modules/routines/__tests__/service.test.ts` — 28 tests
5. `packages/ui/src/hooks/useRoutines.ts` — TanStack Query hooks
6. `packages/ui/src/pages/RoutinesPage.tsx` — Full routines management UI
7. `packages/ui/src/pages/GovernancePage.tsx` — Full governance UI

### Modified Files (6)
1. `packages/server/prisma/schema.prisma` — Extended Routine model + added RoutineRun model
2. `packages/server/src/index.ts` — Registered routines routes
3. `packages/server/src/modules/heartbeat/schema.ts` — Added PAUSED_FOR_APPROVAL status
4. `packages/server/src/modules/heartbeat/service.ts` — Added approval check + resume logic
5. `packages/server/src/modules/governance/service.ts` — Added heartbeat resume on approval decision
6. `packages/server/src/utils/activity.ts` — Added ROUTINE_* activity actions

### Documentation Files (4)
1. `docs/dev-notes/DEV-NOTES-STORY-014.md`
2. `docs/queue/completion-review-STORY-014.md`
3. `docs/qa/QA-REVIEW-STORY-014.md`
4. `docs/release/merge-close-STORY-014.md`

## Test Results
```
Test Files  7 passed (7)
Tests       166 passed (166)
Duration    1.81s
```

## Breaking Changes
None. All existing tests pass without modification.

## Database Migration Required
Yes — the Routine model was extended and the RoutineRun model was added. A Prisma migration is needed:
```bash
npx prisma migrate dev --name add-routine-extensions-and-routine-runs
```

## Suggested Commit Message
```
feat(STORY-014): implement routines & scheduling + approval-heartbeat integration

- Add Routines module: CRUD, cron scheduling, concurrency/catch-up policies
- Add RoutineRun model for execution history
- Add PAUSED_FOR_APPROVAL heartbeat state
- Add approval-gate logic in heartbeat engine
- Add Routines UI (list, create, detail, run history)
- Add Governance UI (stats, filters, decision modal)
- 28 new tests, 166 total passing
```

## Checklist
- [x] Code implemented
- [x] Tests written and passing
- [x] Dev notes created
- [x] Completion review passed
- [x] QA review passed
- [x] No breaking changes
- [ ] Database migration applied
- [ ] Merged to main branch
- [ ] Story closed
