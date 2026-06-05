# Dev Notes
Story ID: STORY-017

## Story Context Reviewed
- **Story:** STORY-017 — Dashboard UI: Secret Management
- **Requirement IDs:** NFR-004 (Security), FR-010 (Dashboard UI)
- **Dependencies:** STORY-010 (Dashboard UI Layout), STORY-016 (Security: Secret Management & Injection)
- **Goal:** Create the Settings/Secrets page in the dashboard where users can input API keys that their AI agents will need.
- **Key Constraint:** The UI must NEVER receive decrypted secret values back from the API.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `packages/ui/src/hooks/useSecrets.ts` | **Created** | TanStack Query hooks for secret CRUD operations |
| `packages/ui/src/pages/SettingsPage.tsx` | **Updated** | Full secret management UI with table, form, and delete |
| `packages/ui/src/test/components.test.tsx` | **Updated** | Added 12 new tests for SettingsPage |

## Implementation Summary

### 1. `useSecrets.ts` Hook
Created TanStack Query hooks following existing patterns from `useTasks.ts` and `useRoutines.ts`:
- **`useSecrets(filters?)`** — Query hook to fetch secrets list with optional scope filter. Connects to `GET /api/secrets?scope=GLOBAL|AGENT`.
- **`useCreateSecret()`** — Mutation hook to create a new secret. Sends `{ name, value, scope }` to `POST /api/secrets`. Handles 409 duplicate name errors from the server.
- **`useDeleteSecret()`** — Mutation hook to delete a secret by ID. Calls `DELETE /api/secrets/:id`.
- All hooks use `@/lib/api` (Hono RPC client) for type-safe API calls.
- Query invalidation on mutation success ensures the UI stays in sync.

### 2. `SettingsPage.tsx` UI
Updated the placeholder SettingsPage with a full secret management interface:
- **Secrets Table** — Displays existing secrets with masked values, scope badges, and delete buttons.
- **Add Secret Form** — Expandable form with:
  - Name input (auto-uppercase, with UPPER_SNAKE_CASE hint)
  - Value input (password field with show/hide toggle using `Eye`/`EyeOff` icons)
  - Scope select (Global or Agent)
  - Client-side validation for UPPER_SNAKE_CASE naming convention
  - Server error display (e.g., duplicate name 409)
- **Scope Filter** — Toggle between All, Global, and Agent scopes.
- **Delete Confirmation Modal** — Confirmation dialog before deleting a secret, with clear warning about impact.
- **Loading/Empty States** — Skeleton loading animations and empty state messaging.
- **Styling** — Tailwind CSS matching existing pages (GovernancePage, TasksPage patterns). Uses Lucide icons.

### 3. Tests Added
Added 12 tests in `components.test.tsx` for the SettingsPage:
- Renders settings heading and secrets section
- Shows loading state or empty state
- Toggles add secret form visibility
- Validates UPPER_SNAKE_CASE naming
- Auto-uppercase name input
- Scope filter buttons
- Form cancel clears error state
- Scope dropdown options

## Tests Added or Updated
- **File:** `packages/ui/src/test/components.test.tsx`
- **Test suite:** `describe('SettingsPage')`
- **Count:** 12 new tests

## Test Commands Run
```bash
npx vitest run --reporter=verbose
```

## Test Results
All 144 tests passed (including 12 new SettingsPage tests).
```
Test Files  1 passed (1)
Tests  144 passed (144)
Duration  4.64s
```

## Commit Notes
Suggested commit message:
```
feat(ui): add secret management to Settings page (STORY-017)

- Create useSecrets hook with useSecrets, useCreateSecret, useDeleteSecret
- Update SettingsPage with secrets table, add form, delete modal
- Client-side UPPER_SNAKE_CASE validation for secret names
- Password-style value input with show/hide toggle
- Scope filter (All, Global, Agent)
- Delete confirmation modal with impact warning
- Add 12 tests for SettingsPage UI interactions
```

## Risks / Limitations
- The Hono RPC client (`hc<AppType>`) uses a base `Hono` type (not the full `AppType`), so route-level type inference is not fully enforced at compile time. This matches the existing pattern used by all other hooks.
- No update/edit endpoint exists for secrets (server only supports create/delete). If a user needs to change a secret value, they must delete and re-create it.
- The form resets scope to 'GLOBAL' by default each time it opens.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
