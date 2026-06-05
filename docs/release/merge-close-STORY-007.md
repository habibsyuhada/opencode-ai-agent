# Merge & Close — STORY-007
Story: Hono RPC API Setup and Core Routes
Status: Ready for Merge

## Summary
Implemented Hono RPC client/server structure for end-to-end type safety between the ArmiAI server API and the React dashboard UI.

## Changes

### Server (`packages/server`)
- **`src/index.ts`**: Restructured route setup from imperative calls to method chaining. This enables Hono's type system to infer all route signatures for the RPC client. Exported `AppType` type.
- **`package.json`**: Added `main`, `types`, and `exports` fields for proper module resolution.
- **`src/rpc-types.ts`**: Created dedicated type-only export file for `AppType`.
- **`src/__tests__/rpc-routes.test.ts`**: Added 10 integration tests verifying RPC route structure.

### UI (`packages/ui`)
- **`src/lib/api.ts`**: Created Hono RPC client (`hc`) setup with `AppType` generic. Configurable base URL via `VITE_API_URL`.
- **`src/types/env.d.ts`**: Added Vite client type references.
- **`package.json`**: Added `hono` dependency.

## Verification
- Server typecheck: PASS
- Server tests: 62/62 PASS
- UI typecheck: PASS
- Dependencies installed: PASS

## Commit Message
```
feat(server,ui): set up Hono RPC client/server structure (STORY-007)

- Restructure server route setup to use method chaining for Hono RPC type inference
- Export AppType from server for end-to-end type safety
- Create Hono RPC client (hc) in packages/ui/src/lib/api.ts
- Add hono dependency to UI package
- Add main/types/exports fields to server package.json
- Add rpc-routes.test.ts with 10 integration tests
```

## Follow-Up Items
- [ ] When server is built (generating `.d.ts` files), update UI to import actual `AppType` from `@armiai/server` for full route-level type inference
- [ ] Add TanStack Query hooks using the `api` client for data fetching (future story)

## Related
- Story: STORY-007
- Requirements: FR-003 [Server API]
- Acceptance Criteria: AC-004 (Partial)
- Dependencies: STORY-003, STORY-004, STORY-005
