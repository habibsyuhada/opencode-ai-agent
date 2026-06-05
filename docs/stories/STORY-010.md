# STORY-010 — Dashboard UI: Layout & Org Chart Visualization
Status: Ready

## Requirement IDs
- FR-010 [Dashboard UI]
- AC-004

## Acceptance Criteria IDs
- AC-004: The React Dashboard accurately displays tasks, budgets, and the agent org chart.

## Business Context
Users need a visual way to understand the structure of their AI team. The org chart is a key feature of the ArmiAI platform.

## Technical Context
Building React components to fetch agent data via Hono RPC and display it as a hierarchical tree or nested list.

## Scope
- Create the main dashboard layout (Sidebar, Header, Main Content area).
- Create the `Agents` page.
- Fetch agent data using TanStack Query and the `hc` client.
- Build an Org Chart component to display the parent-child relationships of agents (using `managerId`).

## Out of Scope
- Hiring new agents (create functionality).
- Task management UI.

## Files Likely Affected
- `/packages/ui/src/components/Layout.tsx` (new)
- `/packages/ui/src/components/Sidebar.tsx` (new)
- `/packages/ui/src/pages/AgentsPage.tsx` (new)
- `/packages/ui/src/components/OrgChart.tsx` (new)

## Implementation Notes
- You can use a library like `react-flow` or build a simple recursive CSS-based tree for the org chart depending on complexity.

## Test Requirements
- The UI successfully renders the seeded agents in their correct hierarchical structure.

## Edge Cases
- Orphaned agents (no manager) should still be displayed at the root level.

## Dependencies
- STORY-002 (Initial UI Package Setup)
- STORY-007 (Hono RPC API Setup and Core Routes)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
