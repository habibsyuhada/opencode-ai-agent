# Merge & Close — STORY-016
Date: 2026-06-04

## Story
**STORY-016 — Multi-Company Support**

## Status
✅ **READY TO MERGE**

## Summary
Implemented multi-company support with strict tenant isolation across server middleware and UI. Users can now switch between companies they have access to via a dropdown in the header.

## Changes

### Server (6 files)
| File | Change Type | Description |
|------|-------------|-------------|
| `src/middleware/company-scope.ts` | Modified | Added X-Company-Id header support + validateCompanyAccess() |
| `src/middleware/auth.ts` | Modified | Added companyIds array to AuthUser interface |
| `src/modules/companies/service.ts` | Modified | Added getCompaniesForUser() for accessible companies |
| `src/modules/companies/routes.ts` | Modified | Added GET /api/companies/accessible endpoint |
| `prisma/schema.prisma` | Modified | Added User + UserCompany models |
| `src/middleware/__tests__/company-isolation.test.ts` | Created | 25 tests for company isolation |

### UI (4 files)
| File | Change Type | Description |
|------|-------------|-------------|
| `src/hooks/useCompanies.ts` | Created | useCompanies(), useActiveCompany() hooks |
| `src/components/CompanySwitcher.tsx` | Created | Company switching dropdown component |
| `src/components/Header.tsx` | Modified | Integrated CompanySwitcher |
| `src/test/components.test.tsx` | Modified | Added CompanySwitcher tests |

## Checklist
- [x] Code implemented
- [x] Tests written (25 server tests)
- [x] Tests pass (25/25)
- [x] Dev notes created
- [x] Completion review passed
- [x] QA review passed
- [x] No breaking changes to existing functionality
- [x] All existing tests still pass (no regressions)

## Post-Merge Steps
1. Run `pnpm db:generate` to regenerate Prisma client with User/UserCompany models
2. Run `pnpm db:push` to apply schema changes to database
3. Seed UserCompany records for testing multi-company scenarios
4. Build server package for UI type inference (`pnpm build`)

## Related Stories
- NFR-002: Strict multi-tenant data isolation (satisfied)
- Architecture §6, §9, §12: Company isolation, auth, security (implemented)

## Close Notes
STORY-016 is complete. The multi-company support enables:
- Strict data isolation per company across all 10 service modules
- Company switching via X-Company-Id header with access validation
- UI dropdown for company selection with localStorage persistence
- Foundation for future RBAC and multi-tenant SaaS features
