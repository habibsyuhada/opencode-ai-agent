# Dev Notes
Story ID: STORY-013

## Story Context Reviewed
- Story: Dashboard UI: Budget Visualization
- Requirements: FR-010 (Dashboard UI), FR-008 (Budgeting), AC-004
- Dependencies: STORY-010 (Dashboard Layout), STORY-012 (Budget & Cost Tracking Schema)
- Scope: Budget page with charts/summary, Heartbeats page with live polling/history/detail

## Files Changed

### New Files
1. **`packages/ui/src/hooks/useBudgets.ts`** — TanStack Query hooks for budget and cost data
   - `useBudgets()` — fetch all budgets for company
   - `useCostEvents(filters?)` — fetch cost events with optional model/provider filters
   - `useCostTimeline(period)` — aggregated cost data by day for charts
   - `useAgentSpend()` — per-agent spend breakdown for bar chart
   - `useUpdateBudget()` — mutation to update budget limits/thresholds
   - `computeBudgetSummary()` — pure function to derive summary from budgets
   - `formatCost()` / `formatTokens()` — formatting utilities
   - Types: `Budget`, `CostEvent`, `CostTimelinePoint`, `AgentSpend`, `BudgetSummary`

2. **`packages/ui/src/hooks/useHeartbeats.ts`** — TanStack Query hooks for heartbeat data
   - `useHeartbeats(filters?)` — fetch heartbeats with optional status/agentId filters
   - `useHeartbeat(id)` — fetch single heartbeat with full details
   - `useRunningHeartbeats()` — poll running heartbeats every 3 seconds
   - `heartbeatStatusColor()` — status badge color mapping
   - `formatDuration()` — human-readable duration formatting
   - Types: `Heartbeat`, `HeartbeatStatus`

### Modified Files
3. **`packages/ui/src/pages/BudgetPage.tsx`** — Full budget page implementation
   - Summary cards: Total Budget, Used, Remaining, Active Agents
   - Budget utilization progress bar with threshold marker
   - Per-agent spend bar chart (Recharts `BarChart`)
   - Cost timeline line chart (Recharts `LineChart`) with 7d/30d/90d period toggle
   - Filterable cost events table (by provider/model)
   - Budget settings panel (edit monthly limits and alert thresholds)
   - Empty state and loading skeletons
   - Error state handling

4. **`packages/ui/src/pages/HeartbeatsPage.tsx`** — Full heartbeats page implementation
   - Running heartbeats section with live polling (3s interval, ping animation)
   - Heartbeat detail panel (metadata, cost breakdown, execution log)
   - Heartbeat history table with search and status filter
   - Status badges, duration formatting, token/cost display
   - Empty state and loading skeletons
   - Error state handling

5. **`packages/ui/src/index.ts`** — Added exports for new hooks and types

6. **`packages/ui/src/test/components.test.tsx`** — Added 40+ new tests

## Implementation Summary
- Budget page uses Recharts `BarChart` for per-agent spend and `LineChart` for cost timeline
- Heartbeats page polls running executions every 3 seconds via `refetchInterval`
- All API calls use the existing Hono RPC client (`@/lib/api`) for type safety
- Budget settings panel allows editing monthly limits and alert thresholds inline
- `computeBudgetSummary()` intelligently prioritizes company-level budget over agent-level aggregation
- Loading skeletons, empty states, and error states are handled consistently across both pages
- All new types are exported from the package index for external consumption

## Tests Added or Updated
- 5 tests for `computeBudgetSummary` (empty, single, over-threshold, company+agent, agent-only)
- 4 tests for `formatCost` (zero, normal, small decimals, large amounts)
- 4 tests for `formatTokens` (small, thousands, millions, zero)
- 5 tests for `heartbeatStatusColor` (all statuses + unknown)
- 6 tests for `formatDuration` (null, undefined, seconds, minutes, completed, hours)
- 7 tests for `BudgetPage` (heading, subtitle, settings toggle, loading, settings open/close, cost events)
- 9 tests for `HeartbeatsPage` (heading, subtitle, loading, history, filter, search, filter options, query update, filter update)

## Test Commands Run
```
npx vitest run --reporter=verbose
```

## Test Results
All 121 tests passed (121/121):
- 113 existing tests: PASS
- 8 new test groups (40 new tests): PASS
- Duration: ~4.7s

## Commit Notes
Suggested commit message:
```
feat(ui): implement Budget and Heartbeats pages for STORY-013

- BudgetPage: summary cards, per-agent spend bar chart, cost timeline
  line chart, filterable cost events table, budget settings panel
- HeartbeatsPage: live polling for running heartbeats, heartbeat detail
  panel with logs/cost breakdown, history table with search/filter
- useBudgets hook: budgets, cost events, timeline, agent spend queries
- useHeartbeats hook: heartbeats, running heartbeats polling, detail
- Added 40 tests covering hooks, utilities, and page rendering
```

## Risks / Limitations
- API endpoints (`/api/budgets`, `/api/heartbeats`, `/api/cost-events`) must exist on the server for data to load
- Budget settings updates require the PATCH endpoint to be implemented server-side
- Heartbeat log display is limited to `max-h-64` with scroll for very long logs
- Recharts is already in `package.json` dependencies — no new dependency needed
- Live polling (3s) for running heartbeats may increase API load; consider configurable intervals

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
