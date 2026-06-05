# QA Review (Re-Review After Bugfixes)

**Story ID:** STORY-020
**Story Title:** End-to-End System Polish & QA
**Status:** PASS
**Original Review Date:** 2026-06-05
**Re-Review Date:** 2026-06-05

---

## Re-Review Summary

This is a re-review after bugfixes were applied to address 4 multi-tenant isolation bugs found in the original QA review. All 4 bugs have been verified as fixed. The companies module now enforces proper access control via the UserCompany junction table. All 335 tests pass (16 files, +36 new tests from 299 baseline).

---

## Original Bugs — Verification

### Bug 1: updateCompany() / deleteCompany() Access Control — ✅ FIXED

**Was:** `userId` parameter accepted but never used. Any authenticated user could update/delete any company.
**Now:** `userId` is **required** (no longer optional). Both functions call `getUserCompanyMembership(userId, id)` to verify the user has membership, then check `ADMIN_ROLES.includes(membership.role)` to ensure only OWNER or ADMIN can modify or delete. Returns `null` (→ 404) on access denied.

**Code verified:**
- `service.ts` line 159: `updateCompany(id, data, userId: string)` — userId required
- `service.ts` line 170: `getUserCompanyMembership(userId, id)` — membership lookup
- `service.ts` line 179: `ADMIN_ROLES.includes(membership.role)` — role check
- `service.ts` line 204: `deleteCompany(id, userId: string)` — same pattern
- Stub users (`userId.startsWith('stub-')`) retain backward compatibility

**Test coverage (12 tests):**
- OWNER allowed ✅, ADMIN allowed ✅, MEMBER denied ✅, no-membership denied ✅
- Company not found → null ✅, stub user fallback ✅

### Bug 2: GET /api/companies/:id Membership Verification — ✅ FIXED

**Was:** Route called `getCompanyById(id)` directly with no user scoping.
**Now:** Route calls `getCompanyByIdForUser(id, user.id)` which checks UserCompany junction table membership. Returns null (→ 404) when user has no membership and is not a stub user.

**Code verified:**
- `routes.ts` line 65: `getCompanyByIdForUser(id, user.id)` — user-scoped query
- `service.ts` lines 88-111: `getCompanyByIdForUser()` — checks membership, stub fallback

**Test coverage (4 tests):**
- Member access → 200 ✅, non-member denied → 404 ✅, stub fallback → 200 ✅, non-existent → 404 ✅

### Bug 3: POST /api/companies UserCompany Junction Record — ✅ FIXED

**Was:** `createCompany()` only created the Company record, leaving it orphaned.
**Now:** `createCompany(data, userId)` uses `prisma.$transaction()` to atomically create both Company and UserCompany records. Creator is assigned OWNER role. Route passes `user.id`.

**Code verified:**
- `service.ts` line 122: `createCompany(data, userId: string)` — userId required
- `service.ts` lines 124-143: `prisma.$transaction()` — atomic creation of Company + UserCompany
- `routes.ts` line 83: `createCompany(data, user.id)` — passes user ID

**Test coverage (3 tests):**
- Transaction creates both records ✅, mission field included ✅, route-level junction record ✅

### Bug 4: listCompanies() Removed — ✅ FIXED

**Was:** `listCompanies()` exported and returned ALL companies without user filtering.
**Now:** Completely removed from `service.ts`. `getCompaniesForUser()` is the only list function. Verified no source file imports `listCompanies` — all references are in documentation and test assertions verifying its absence.

**Test coverage (2 tests):**
- Service: `listCompanies` is undefined ✅, Routes: not imported ✅

---

## Acceptance Criteria Check

### AC-1: Full User Journey Test — PASS (unchanged)

E2E test suite covers 17 tests across 7 groups. All pass.

### AC-2: Fix Layout Inconsistencies — PASS (unchanged)

ActivityPage.tsx (331 lines) fully implemented with stats, filters, table, loading/empty/error states. Properly wired into App.tsx and Sidebar.tsx.

### AC-3: Multi-Tenant Isolation — PASS (was FAIL, now fixed)

All 4 companies module bugs have been fixed:
- `updateCompany()` / `deleteCompany()` enforce OWNER/ADMIN role check via UserCompany junction table
- `GET /:id` verifies user-company membership before returning data
- `POST /` creates UserCompany junction record with OWNER role in a transaction
- `listCompanies()` removed — only `getCompaniesForUser()` remains

Stub user backward compatibility is preserved throughout, ensuring the current stub auth mode continues to work while the code is architecturally correct for real authentication.

### AC-4: Optimize Slow Prisma Queries — PASS (unchanged)

7 compound indexes added. No changes in this bugfix round.

---

## Test Commands Run

```bash
# Full server test suite
powershell -ExecutionPolicy Bypass -Command "npx vitest run"
# Working directory: packages/server
# Result: 16 test files, 335 tests passed (0 failed) — 2.58s
```

---

## Test Results

| Suite | Files | Tests | Passed | Failed | Duration |
|-------|-------|-------|--------|--------|----------|
| Server (full) | 16 | 335 | 335 | 0 | 2.58s |

**Baseline was 299 tests / 14 files. New: 335 tests / 16 files (+36 tests in 2 new test files).**

All tests pass. No regressions.

---

## Manual Review

### Service Layer (`service.ts` — 231 lines)
- Clean separation of concerns: `getUserCompanyMembership()` is a shared helper used by 3 functions
- `ADMIN_ROLES` constant (`['OWNER', 'ADMIN']`) is clear and extensible
- Transaction in `createCompany()` ensures atomicity — no orphaned companies
- JSDoc comments now accurately describe the behavior (no more misleading claims)
- Stub fallback logic is consistent across all functions

### Routes Layer (`routes.ts` — 128 lines)
- All handlers correctly pass `user.id` from `c.get('user')` to service functions
- Imports updated: `getCompanyByIdForUser` replaces `getCompanyById`
- `listCompanies` no longer imported

### Test Coverage
- **Service tests (24):** Thorough role-based access control testing (OWNER, ADMIN, MEMBER, no-membership, non-existent company, stub fallback)
- **Route tests (12):** HTTP-level verification with Hono test client, simulating real request/response flow
- Both test files use proper mocking of Prisma and verify the correct database calls are made

---

## Edge Cases Checked

1. **Cross-company update attempt by MEMBER**: Returns null → 404 ✅
2. **Cross-company delete attempt by non-member**: Returns null → 404 ✅
3. **GET /:id for company user doesn't belong to**: Returns null → 404 ✅
4. **Stub user accessing any company**: Works via fallback (backward compat) ✅
5. **Company creation creates junction record**: Transaction ensures both records ✅
6. **listCompanies import from other modules**: Function removed, import would fail ✅
7. **Membership exists but company deleted**: Returns null ✅
8. **Double task checkout**: Previously verified, still passes ✅
9. **Empty activity state**: Previously verified, still passes ✅

---

## Bugs Found

**0 bugs found.** All 4 previously reported bugs have been fixed and verified.

---

## Regression Risk

**Low.** The changes are confined to the companies module:
- `service.ts`: Major rewrite of 5 functions + 1 new helper, 1 removal
- `routes.ts`: Updated 2 handlers (GET /:id, POST /), updated imports
- 36 new tests provide comprehensive coverage of the changes
- All 335 tests pass (299 existing + 36 new)
- Other modules (agents, tasks, heartbeat, budget, governance, activity, routines, secrets, projects, goals) are untouched

---

## Final Verdict

**PASS — All 4 bugs fixed, all acceptance criteria satisfied.**

The companies module now enforces proper multi-tenant isolation:
- `updateCompany()` and `deleteCompany()` verify OWNER/ADMIN role via UserCompany junction table
- `GET /api/companies/:id` verifies user membership before returning data
- `POST /api/companies` atomically creates both Company and UserCompany (OWNER) records
- `listCompanies()` has been removed — `getCompaniesForUser()` is the only list function

The code is architecturally correct and will work properly when real authentication replaces the current stub mode. Stub user backward compatibility is preserved for current development workflow.

---

**Reviewer:** QA Engineer
**Original Review Date:** 2026-06-05
**Re-Review Date:** 2026-06-05
**Result:** PASS — Story ready to close
