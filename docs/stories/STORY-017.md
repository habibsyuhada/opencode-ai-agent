# STORY-017 — Dashboard UI: Secret Management
Status: Ready

## Requirement IDs
- NFR-004 [Security]
- FR-010 [Dashboard UI]

## Acceptance Criteria IDs
- N/A

## Business Context
Users need a way to input the API keys that their AI agents will need.

## Technical Context
Building the Settings/Secrets page in the dashboard.

## Scope
- Create an API route in Hono to create/update secrets (encrypting them before save).
- Create API route to list secrets (returning metadata only, NOT the decrypted values).
- Create a `Settings` or `Secrets` page in the React UI.
- Provide a form to add new secrets.

## Out of Scope
- Viewing decrypted values in the UI (security risk).

## Files Likely Affected
- `/packages/server/src/routes/secrets.ts` (new)
- `/packages/ui/src/pages/SettingsPage.tsx` (new)

## Implementation Notes
- The UI should never receive the decrypted secret back from the API once saved.

## Test Requirements
- User can input a secret in the UI, and it is saved encrypted in the database.

## Edge Cases
- Handling duplicate secret names.

## Dependencies
- STORY-010 (Dashboard UI Layout)
- STORY-016 (Security: Secret Management & Injection)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
