# Bugfix Notes

**Story ID:** STORY-020
**Bug Report:** docs/qa/BUG-REPORT-STORY-020.md
**Date:** 2026-06-05

---

## Root Cause

The companies module was originally implemented without proper multi-tenant isolation. Four specific gaps existed:

1. **`updateCompany()` and `deleteCompany()`** accepted a `userId` parameter but never used it — the JSDoc claimed access control validation but no such logic existed. Any authenticated user could modify or delete any company.

2. **`GET /api/companies/:id`** called `getCompanyById(id)` directly with no user scoping, returning any company's data to any authenticated user.

3. **`createCompany()`** only created the `Company` record without creating a `UserCompany` junction record, leaving newly created companies orphaned (no user had membership).

4. **`listCompanies()`** was still exported despite being replaced by `getCompaniesForUser()` — it returned ALL companies with no user filtering, bypassing isolation if imported elsewhere.

---

## Fix Summary

### Bug 1: Access control in updateCompany() and deleteCompany()

**Changed:** `packages/server/src/modules/companies/service.ts`

- Made `userId` parameter **required** (no longer optional) for both `updateCompany()` and `deleteCompany()`
- Added `getUserCompanyMembership()` lookup against the `UserCompany` junction table before allowing update/delete
- Only users with `OWNER` or `ADMIN` role can modify or delete a company
- Returns `null` (which the route maps to 404) when access is denied
- Stub users (`userId.startsWith('stub-')`) retain backward compatibility via fallback

### Bug 2: User-company membership verification in GET /:id

**Changed:** `packages/server/src/modules/companies/service.ts`, `packages/server/src/modules/companies/routes.ts`

- Added new `getCompanyByIdForUser(id, userId)` function that verifies membership via `UserCompany` junction table before returning company data
- Returns `null` when user has no membership (route returns 404)
- Includes `userRole` in the response for the authenticated user
- Stub users retain backward compatibility via fallback
- Updated route to pass `user.id` to the new function (replaced `getCompanyById` import)

### Bug 3: UserCompany junction record on company creation

**Changed:** `packages/server/src/modules/companies/service.ts`, `packages/server/src/modules/companies/routes.ts`

- `createCompany()` now accepts a required `userId` parameter
- Uses `prisma.$transaction()` to atomically create both the `Company` and `UserCompany` records
- Creator is assigned `OWNER` role in the junction record
- Returns company with `userRole: 'OWNER'` included
- Route updated to pass `user.id` to `createCompany()`

### Bug 4: Removed listCompanies()

**Changed:** `packages/server/src/modules/companies/service.ts`

- Completely removed the `listCompanies()` function and its export
- `getCompaniesForUser()` is the correct replacement that respects multi-tenant isolation
- Verified no other files in the codebase import `listCompanies()`

### Helper function added

- `getUserCompanyMembership(userId, companyId)` — shared helper that queries the `UserCompany` junction table using the compound unique key `userId_companyId`. Used by `getCompanyByIdForUser()`, `updateCompany()`, and `deleteCompany()`.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/server/src/modules/companies/service.ts` | Major rewrite — added access control, removed `listCompanies()`, added `getCompanyByIdForUser()`, `getUserCompanyMembership()`, made `userId` required in `createCompany`/`updateCompany`/`deleteCompany` |
| `packages/server/src/modules/companies/routes.ts` | Updated imports, GET /:id now uses `getCompanyByIdForUser`, POST / now passes `user.id` to `createCompany` |

---

## Tests Added or Updated

| Test File | Tests | Description |
|-----------|-------|-------------|
| `packages/server/src/modules/companies/__tests__/service.test.ts` | 24 | Unit tests for all service functions: access control in update/delete, membership verification in getCompanyByIdForUser, UserCompany creation in createCompany, listCompanies removal |
| `packages/server/src/modules/companies/__tests__/routes.test.ts` | 12 | HTTP-level tests for routes: GET /:id membership check, POST / junction record, PATCH /:id access control, DELETE /:id access control |

**Total new tests: 36**

---

## Test Commands Run

```bash
# Run companies module tests only
powershell -ExecutionPolicy Bypass -Command "npx vitest run src/modules/companies/__tests__/"
# Result: 2 test files, 36 tests passed (0 failed) — 0.71s

# Run full server test suite
powershell -ExecutionPolicy Bypass -Command "npx vitest run"
# Result: 16 test files, 335 tests passed (0 failed) — 2.64s
```

---

## Test Results

| Suite | Files | Tests | Passed | Failed | Duration |
|-------|-------|-------|--------|--------|----------|
| Companies (new) | 2 | 36 | 36 | 0 | 0.71s |
| Server (full) | 16 | 335 | 335 | 0 | 2.64s |

All tests pass. No regressions. Previous baseline was 299 tests across 14 files.

---

## Ready for QA Recheck?

Status: READY_FOR_QA_RECHECK

All 4 reported bugs have been fixed:
- Bug 1 (HIGH): `updateCompany()` and `deleteCompany()` now enforce access control via UserCompany junction table — only OWNER/ADMIN can modify/delete
- Bug 2 (MEDIUM): `GET /api/companies/:id` now verifies user-company membership before returning data
- Bug 3 (MEDIUM): `POST /api/companies` now creates a UserCompany junction record with OWNER role in a transaction
- Bug 4 (LOW): `listCompanies()` has been removed from the codebase

Stub user backward compatibility is preserved throughout — stub users retain automatic admin access to any existing company. This ensures the existing stub auth mode continues to work while the code is architecturally correct for real authentication.
