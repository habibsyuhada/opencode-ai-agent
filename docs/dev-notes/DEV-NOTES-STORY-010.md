# Dev Notes — STORY-010
Story ID: STORY-010 — Dashboard UI: Layout & Org Chart Visualization

## Story Context Reviewed
- Reviewed `docs/stories/STORY-010.md` — Layout, Sidebar, OrgChart, React Router, TanStack Query.
- Reviewed `docs/prd/prd.md` — FR-010 Dashboard UI, AC-004 agent org chart display.
- Reviewed `docs/architecture/architecture.md` — UI Structure (§8), Tech Stack (§4), folder structure.
- Reviewed existing `packages/ui/src/` — minimal Hello World app with Tailwind, Vite, React 19.
- Dependencies STORY-002 (UI Package Setup) and STORY-007 (Hono RPC API) confirmed in place.

## Files Changed
- `packages/ui/package.json` — added `lucide-react`, `recharts`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; added `test` and `test:watch` scripts.
- `packages/ui/vite.config.ts` — added `@` path alias.
- `packages/ui/tsconfig.json` — added `baseUrl` and `paths` for `@/*`.
- `packages/ui/vitest.config.ts` (new) — Vitest configuration with jsdom, React plugin, path alias.
- `packages/ui/src/test/setup.ts` (new) — Test setup importing jest-dom matchers.
- `packages/ui/src/test/components.test.tsx` (new) — 17 unit tests for Sidebar, Header, Layout, OrgChart, buildAgentTree, HomePage, AgentsPage.
- `packages/ui/src/components/Sidebar.tsx` (new) — Collapsible sidebar with NavLink items for all 9 routes (Home, Agents, Tasks, Budget, Heartbeats, Governance, Routines, Activity, Settings). Uses lucide-react icons.
- `packages/ui/src/components/Header.tsx` (new) — Top header bar with search input, notification bell, user avatar.
- `packages/ui/src/components/Layout.tsx` (new) — Main layout wrapping Sidebar + Header + `<Outlet />` from react-router-dom.
- `packages/ui/src/components/OrgChart.tsx` (new) — Recursive org chart component with `buildAgentTree()` helper. Converts flat agent list (with `managerId`) into a tree and renders nested `TreeNode` cards. Handles orphaned agents at root level.
- `packages/ui/src/pages/HomePage.tsx` (new) — Dashboard with 4 stat cards (Active Agents, Open Tasks, Monthly Spend, Heartbeats Today) and recent activity placeholder.
- `packages/ui/src/pages/AgentsPage.tsx` (new) — Agents page with OrgChart component.
- `packages/ui/src/pages/TasksPage.tsx` (new) — Placeholder tasks/kanban page.
- `packages/ui/src/pages/BudgetPage.tsx` (new) — Placeholder budget/cost page.
- `packages/ui/src/pages/HeartbeatsPage.tsx` (new) — Placeholder heartbeats page.
- `packages/ui/src/pages/GovernancePage.tsx` (new) — Placeholder governance/approvals page.
- `packages/ui/src/pages/RoutinesPage.tsx` (new) — Placeholder routines page.
- `packages/ui/src/pages/ActivityPage.tsx` (new) — Placeholder activity/audit page.
- `packages/ui/src/pages/SettingsPage.tsx` (new) — Placeholder settings page.
- `packages/ui/src/App.tsx` — Replaced Hello World with full React Router setup + TanStack Query provider. 9 routes defined under `<Layout />`.
- `packages/ui/src/main.tsx` — Minor cleanup (unchanged functionally).
- `packages/ui/src/index.ts` — Added exports for all components, pages, and types.

## Implementation Summary
1. Installed `lucide-react` (icons) and `recharts` (charts) as production dependencies.
2. Installed `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as dev dependencies for testing.
3. Created a responsive layout with collapsible sidebar (dark theme, 64px collapsed / 256px expanded) and top header bar.
4. Sidebar has 9 navigation items using `react-router-dom`'s `NavLink` with active state highlighting.
5. Set up React Router with `<BrowserRouter>` in App.tsx, with `<Layout />` as the parent route and 9 child routes.
6. Configured TanStack Query's `QueryClientProvider` with 30s stale time and 1 retry.
7. Built `OrgChart` component using a recursive CSS-based tree approach (no heavy dependencies like react-flow needed for MVP). `buildAgentTree()` converts a flat agent list into a tree using `managerId`.
8. Created 9 placeholder page components matching the architecture document's UI structure (§8).
9. Added `@` path alias in both vite.config.ts and tsconfig.json.
10. All pages are styled with Tailwind CSS for a consistent, clean look.

## Tests Added or Updated
- `packages/ui/src/test/components.test.tsx` — 17 tests:
  - Sidebar: renders nav items (4 tests), hides labels when collapsed, shows brand, toggle callback
  - Header: renders search input, renders user avatar
  - Layout: renders sidebar and header
  - OrgChart: empty state, single agent, parent-child hierarchy
  - buildAgentTree: empty array, root agents, nested children, orphaned agents
  - HomePage: dashboard heading, stat cards
  - AgentsPage: heading and org chart

## Test Commands Run
```bash
pnpm run typecheck  # ✅ passed
pnpm run build      # ✅ passed (tsc && vite build)
pnpm run test       # ✅ 17/17 passed
```

## Test Results
- Typecheck: PASS
- Build: PASS (dist generated successfully)
- Tests: 17/17 PASS (components.test.tsx)

## Commit Notes
Suggested commit message:
```
feat(ui): STORY-010 — Dashboard layout, sidebar nav, and org chart foundation

- Add Layout component with collapsible sidebar and header
- Add Sidebar with 9 nav items (Home, Agents, Tasks, Budget, Heartbeats, Governance, Routines, Activity, Settings)
- Set up React Router with routes for all pages
- Configure TanStack Query provider
- Add OrgChart component with buildAgentTree() for hierarchical display
- Add 9 placeholder page components
- Install lucide-react, recharts, vitest, @testing-library/react
- Add 17 unit tests (all passing)
- Configure path aliases (@/) in vite and tsconfig
```

## Risks / Limitations
- OrgChart uses simple CSS-based tree layout; complex trees with many levels may need scrolling or a library like react-flow for better UX in the future.
- Placeholder pages contain static content; data fetching will be wired up in subsequent stories.
- No E2E tests yet; component-level tests cover rendering and core logic.
- The `@armiai/shared` workspace dependency is referenced but not yet used in UI code.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
