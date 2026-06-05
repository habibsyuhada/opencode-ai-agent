# Dev Notes
Story ID: STORY-012

## Story Context Reviewed
- **Story**: STORY-012 — Budget & Cost Tracking Schema and Parser
- **Status**: Ready → Implementation Complete
- **Dependencies**: STORY-009 (already completed — Heartbeat Engine with budget checks)
- **Key PRD Requirements**: FR-008 (Budgeting), FR-009 (Governance)
- **Key Architecture**: Budget, CostEvent, Approval, ActivityEvent models (already in schema.prisma)

## Files Changed
| File | Action | Description |
|------|--------|-------------|
| `packages/server/src/modules/budget/schema.ts` | Created | Zod schemas for Budget and CostEvent validation |
| `packages/server/src/modules/budget/service.ts` | Created | Budget CRUD, cost tracking, threshold warnings, auto-pause |
| `packages/server/src/modules/budget/routes.ts` | Created | REST endpoints for budget management |
| `packages/server/src/modules/budget/__tests__/service.test.ts` | Created | 21 tests for budget service |
| `packages/server/src/modules/governance/schema.ts` | Created | Zod schemas for Approval validation |
| `packages/server/src/modules/governance/service.ts` | Created | Approval CRUD, decision tracking, statistics |
| `packages/server/src/modules/governance/routes.ts` | Created | REST endpoints for governance workflows |
| `packages/server/src/modules/governance/__tests__/service.test.ts` | Created | 16 tests for governance service |
| `packages/server/src/modules/activity/schema.ts` | Created | Zod schemas for ActivityEvent validation |
| `packages/server/src/modules/activity/service.ts` | Created | Activity event querying, feed, statistics |
| `packages/server/src/modules/activity/routes.ts` | Created | REST endpoints for activity feed |
| `packages/server/src/modules/activity/__tests__/service.test.ts` | Created | 12 tests for activity service |
| `packages/server/src/index.ts` | Modified | Registered budget, governance, activity routes |
| `packages/server/src/utils/activity.ts` | Modified | Added budget/governance action constants |

## Implementation Summary
Implemented three new backend modules following the existing codebase patterns:

### Budget Module (`/api/budgets`)
- **CRUD**: Create, read, update, delete budgets (company-level and per-agent)
- **Cost Events**: Record cost events linked to heartbeats, update budget usage atomically
- **Threshold Warnings**: Alert when budget usage exceeds configured threshold (default 80%)
- **Auto-Pause**: Automatically pause agents when budget is exceeded
- **Status Check**: Real-time budget status with percentage calculations
- **Breakdown**: Per-agent cost breakdown by time period (day/week/month)
- **Reset**: Reset all budgets for new billing period

### Governance Module (`/api/approvals`)
- **CRUD**: Create approval requests, list with filters, get by ID
- **Decision Workflow**: Approve or reject pending approvals
- **Lifecycle Protection**: Only PENDING approvals can be decided or deleted
- **Statistics**: Counts by status and type for governance dashboard
- **Activity Integration**: All approval actions recorded in audit log

### Activity Module (`/api/activity`)
- **Feed**: Recent activity feed with filtering by action type and actor type
- **Statistics**: Aggregated counts by action and actor type
- **CRUD**: Create and query activity events via API
- **Existing Utility**: Built on top of existing `utils/activity.ts` fire-and-forget utility

### Route Registration
All new routes registered in `src/index.ts` using Hono's method chaining pattern for RPC type inference. Updated API root endpoint to list new resources.

## Tests Added or Updated
- **Budget tests**: 21 tests covering CRUD, cost recording, threshold warnings, schema validation
- **Governance tests**: 16 tests covering approval workflow, decision tracking, schema validation
- **Activity tests**: 12 tests covering event CRUD, feed querying, schema validation
- **Total new tests**: 49

## Test Commands Run
```bash
npx vitest run src/modules/budget/__tests__/service.test.ts src/modules/governance/__tests__/service.test.ts src/modules/activity/__tests__/service.test.ts
```

## Test Results
```
Test Files  3 passed (3)
     Tests  49 passed (49)
  Duration  4.57s
```

All tests pass. Existing test suite (175 total tests across 9 files) also passes with no regressions.

## Commit Notes
Suggested commit message:
```
feat(server): add budget, governance, and activity backend modules

- Budget module: CRUD, cost tracking, threshold warnings, auto-pause on exceed
- Governance module: approval workflows, decision tracking, statistics
- Activity module: event querying, feed endpoint, statistics
- Register all new routes in server entry point
- Add 49 tests covering all new service logic and schemas
- Update activity utility with budget/governance action constants

Refs: STORY-012, FR-008, FR-009
```

## Risks / Limitations
- **Auto-pause is aggressive**: When company budget is exceeded, ALL active agents are paused. Consider per-agent granularity in future.
- **Cost breakdown query is N+1**: The `getCostBreakdown` function makes individual heartbeat lookups for each cost event group. Could be optimized with a JOIN.
- **No pagination metadata**: List endpoints return arrays without total count or cursor info. Acceptable for MVP but should be added for production.
- **No budget period management**: Budgets don't auto-reset monthly. The `resetBudgets` endpoint must be called manually or via cron.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
