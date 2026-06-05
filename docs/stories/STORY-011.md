# STORY-011 — Dashboard UI: Task Kanban Board
Status: Ready

## Requirement IDs
- FR-010 [Dashboard UI]
- AC-004

## Acceptance Criteria IDs
- AC-004: The React Dashboard accurately displays tasks...

## Business Context
Users need to see what their AI team is working on. A Kanban board is the standard paradigm for tracking software development tasks.

## Technical Context
Building a drag-and-drop (or simple status-based) Kanban board in React, pulling data from the Hono API.

## Scope
- Create the `Tasks` page in the UI.
- Fetch task data using TanStack Query.
- Create columns for typical statuses (e.g., Todo, In Progress, Done).
- Render task cards with basic info (title, assigned agent).
- (Optional) Allow simple drag-and-drop or a button to move tasks between statuses.

## Out of Scope
- Creating new tasks (can be a separate story if complex).
- Real-time websocket updates (polling is fine for now).

## Files Likely Affected
- `/packages/ui/src/pages/TasksPage.tsx` (new)
- `/packages/ui/src/components/KanbanBoard.tsx` (new)
- `/packages/ui/src/components/TaskCard.tsx` (new)

## Implementation Notes
- Consider `dnd-kit` or `react-beautiful-dnd` for drag-and-drop, or keep it simple with dropdown status selectors initially.

## Test Requirements
- Tasks seeded in the database appear in the correct columns based on their status.

## Edge Cases
- Large numbers of tasks causing performance issues (pagination/filtering may be needed later).

## Dependencies
- STORY-010 (Dashboard UI: Layout & Org Chart)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
