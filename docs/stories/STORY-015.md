# STORY-015 — Dashboard UI: Approvals & Settings
Status: Ready

## Requirement IDs
- FR-009 [Governance]
- FR-010 [Dashboard UI]

## Acceptance Criteria IDs
- N/A

## Business Context
Users need an interface to review and action the approvals requested by their AI agents.

## Technical Context
Adding an Approvals view to the dashboard.

## Scope
- Create an `Approvals` view or widget (could be in the main dashboard or a dedicated page).
- Display a list of pending approvals.
- Provide UI buttons to Approve or Reject.
- Link the UI actions to the Hono API endpoints created in STORY-014.

## Out of Scope
- Detailed audit logs (Activity Events).

## Files Likely Affected
- `/packages/ui/src/pages/ApprovalsPage.tsx` (new)
- `/packages/ui/src/components/ApprovalCard.tsx` (new)

## Implementation Notes
- Consider showing a notification badge in the sidebar when there are pending approvals.

## Test Requirements
- Clicking "Approve" successfully updates the state in the database and removes the item from the pending list.

## Edge Cases
- Handling API errors if the approval state changed concurrently.

## Dependencies
- STORY-010 (Dashboard UI Layout)
- STORY-014 (Governance: Approval Workflows)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
