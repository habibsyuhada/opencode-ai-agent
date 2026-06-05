# Dev Notes
Story ID: STORY-011

## Story Context Reviewed
- Read `docs/stories/STORY-011.md` — Dashboard UI: Task Kanban Board
- Read `docs/prd/prd.md` — FR-010 (Dashboard UI), AC-004
- Read `docs/architecture/architecture.md` — Section 7 (API routes), Section 8 (UI Structure)
- Read `docs/queue/dev-queue.md` — STORY-011 was queued
- Reviewed Prisma schema for Agent, Task, Heartbeat, Goal models
- Reviewed existing UI components (OrgChart, Sidebar, Header, Layout)
- Reviewed existing page stubs (AgentsPage, TasksPage)
- Reviewed existing API client (Hono RPC client in `lib/api.ts`)
- Reviewed existing test patterns in `components.test.tsx`

## Files Changed
### New Files Created
1. `packages/ui/src/hooks/useAgents.ts` — TanStack Query hooks for agent CRUD operations + role templates
2. `packages/ui/src/hooks/useTasks.ts` — TanStack Query hooks for task CRUD operations + Kanban constants
3. `packages/ui/src/components/TaskCard.tsx` — Task card component for Kanban board with status transitions
4. `packages/ui/src/components/KanbanBoard.tsx` — 5-column Kanban board (Backlog → Todo → In Progress → Review → Done)
5. `packages/ui/src/components/TaskForm.tsx` — Modal form for creating/editing tasks
6. `packages/ui/src/components/TaskDetail.tsx` — Modal detail view for tasks (description, artifacts, heartbeat history)
7. `packages/ui/src/components/AgentTable.tsx` — Filterable, sortable agent list table
8. `packages/ui/src/components/AgentDetail.tsx` — Agent detail modal with pause/resume/terminate actions
9. `packages/ui/src/components/AgentForm.tsx` — "Hire Agent" form with role template picker

### Modified Files
10. `packages/ui/src/pages/AgentsPage.tsx` — Full implementation with org chart, table view, hire form, detail modal
11. `packages/ui/src/pages/TasksPage.tsx` — Full implementation with Kanban board, list view, create form, detail modal
12. `packages/ui/src/test/components.test.tsx` — Extended from 170 → 805 lines, 81 tests total

## Implementation Summary
### Agents Page
- **Org Chart View**: Uses existing `OrgChart` component with `buildAgentTree` for hierarchical visualization. Agents fetched via `useAgents()` hook.
- **Table View**: New `AgentTable` component with role/status filters, sortable columns (name, role, status, created), and click-to-detail behavior.
- **Agent Detail**: Modal showing agent metadata, config JSON, direct reports, and action buttons (Pause/Resume/Terminate).
- **Hire Agent Form**: Role template picker (CEO, CTO, Scrum Master, Developer, QA Engineer, DevOps) with name/title/manager/config fields.

### Tasks Page
- **Kanban Board**: 5-column board (Backlog, Todo, In Progress, Review, Done) using `KanbanBoard` + `TaskCard` components. Each card shows title, priority badge, assignee, and quick status-move buttons.
- **List View**: Sortable table with search and status filter. Columns: Title, Status, Priority, Assignee, Created.
- **Task Detail**: Full detail modal with description, artifacts list, heartbeat history (tokens used, cost, status).
- **Create Task Form**: Modal form with title, description, goal selection, priority, and agent assignment.

### API Integration
- All data fetching uses TanStack Query hooks (`useAgents`, `useTasks`, `useCreateAgent`, `useUpdateAgent`, `useCreateTask`, `useUpdateTask`, `useMoveTask`)
- Hooks connect to the Hono RPC client (`api.api.agents.$get()`, etc.)
- Query invalidation on mutations ensures UI stays in sync
- Error states handled gracefully with fallback UI messages

### Status Transition Rules
Tasks follow defined status transitions:
- BACKLOG → TODO
- TODO → BACKLOG, IN_PROGRESS
- IN_PROGRESS → TODO, REVIEW
- REVIEW → IN_PROGRESS, DONE
- DONE → REVIEW

## Tests Added or Updated
- **Total tests**: 81 (up from ~24 in STORY-010)
- **New test suites**: KanbanBoard (6 tests), TaskCard (8 tests), TaskForm (7 tests), TaskDetail (9 tests), AgentTable (8 tests), AgentDetail (9 tests), AgentForm (5 tests)
- **Updated page tests**: AgentsPage (5 tests), TasksPage (5 tests)
- **Test helpers**: `makeTask()` and `makeAgent()` factory functions for test data

## Test Commands Run
```bash
npx vitest run
```

## Test Results
```
Test Files  1 passed (1)
     Tests  81 passed (81)
  Duration  20.02s
```
All 81 tests pass.

## Commit Notes
Suggested commit message:
```
feat(ui): implement agents & tasks views for STORY-011

- Agents page: org chart, filterable table, agent detail modal, hire agent form
- Tasks page: kanban board (5 columns), list view, task detail, create task form
- TanStack Query hooks for agent/task CRUD via Hono RPC client
- Role template picker for hiring agents (CEO, CTO, Scrum Master, Dev, QA, DevOps)
- Task status transitions with quick-move buttons on kanban cards
- 81 component and integration tests (all passing)
```

## Risks / Limitations
1. **API Server Required**: All views depend on the Hono API server running. Without it, pages show error/loading states.
2. **No Drag-and-Drop**: Kanban uses button-based status transitions instead of drag-and-drop (avoids adding `dnd-kit` dependency).
3. **No Real-Time Updates**: Uses polling via TanStack Query (30s stale time). No WebSocket integration.
4. **No Pagination**: Large task/agent lists are loaded entirely. Pagination may be needed for scale.
5. **Type Safety Gap**: `AppType` in `api.ts` is currently `Hono` (base type). Full route-level inference requires server package build.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
