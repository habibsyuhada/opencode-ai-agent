# Bug Report

**Story ID:** STORY-020
**Status:** CLOSED (all 4 bugs fixed and verified in QA re-review 2026-06-05)

---

## Summary

Multi-tenant isolation in the companies module is incomplete. The `updateCompany()` and `deleteCompany()` service functions accept a `userId` parameter and have JSDoc comments claiming they validate user access, but the parameter is never used for authorization. Additionally, GET /api/companies/:id does not verify membership, and POST /api/companies does not create a UserCompany junction record. Any authenticated user can read, update, or delete any company.

---

## Bug 1: updateCompany() and deleteCompany() ignore userId — No Access Control

### Steps to Reproduce

1. Authenticate as User A (belonging to Company A)
2. Send `PATCH /api/companies/{companyB-id}` with body `{ "name": "Hacked" }` where companyB belongs to a different user
3. Observe that the update succeeds

### Expected Result

The service should check that the requesting user has admin access to the company via the UserCompany junction table. If the user is not a member or not an admin, the request should be rejected with 403 Forbidden.

### Actual Result

The `updateCompany()` function at `packages/server/src/modules/companies/service.ts:90-108` accepts `userId?` as a parameter but never references it. It only checks if the company exists (line 92-98), then proceeds to update regardless of who is requesting. Same pattern in `deleteCompany()` at lines 116-129.

```typescript
// Current code — userId is accepted but ignored
export async function updateCompany(id: string, data: UpdateCompanyInput, userId?: string) {
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.company.update({ where: { id }, data: { ... } });
  // userId is never checked against UserCompany table
}
```

### Evidence

- `packages/server/src/modules/companies/service.ts` lines 90-108 (updateCompany)
- `packages/server/src/modules/companies/service.ts` lines 116-129 (deleteCompany)
- JSDoc at line 88: "Validates that the requesting user has admin access to the company." — This is false.
- JSDoc at line 114: "Validates that the requesting user has admin access to the company." — This is false.

### Severity

HIGH — Any authenticated user can modify or delete any company's data. This is a security vulnerability that violates the multi-tenant isolation requirement (NFR-002).

### Suggested Area to Inspect

`packages/server/src/modules/companies/service.ts` — `updateCompany()` and `deleteCompany()` functions. Add a UserCompany lookup to verify the user has OWNER or ADMIN role for the target company before allowing the operation.

---

## Bug 2: GET /api/companies/:id Does Not Verify User-Company Membership

### Steps to Reproduce

1. Authenticate as User A (belonging to Company A only)
2. Send `GET /api/companies/{companyB-id}` where companyB is a company the user has no access to
3. Observe that the full company details are returned

### Expected Result

The route should verify that the requesting user has membership in the target company. If not, return 403 Forbidden or 404 Not Found.

### Actual Result

The route at `packages/server/src/modules/companies/routes.ts:55-64` calls `getCompanyById(id)` directly without checking user membership. The `getCompanyById()` service function at `service.ts:66-70` simply does `prisma.company.findUnique({ where: { id } })` with no user scoping.

```typescript
// Current code — no access check
companies.get('/:id', async (c) => {
  const { id } = companyIdParamSchema.parse(c.req.param());
  const company = await getCompanyById(id);  // No user membership check
  if (!company) return c.json({ error: 'Company not found', code: 404 }, 404);
  return c.json({ data: company });
});
```

### Evidence

- `packages/server/src/modules/companies/routes.ts` lines 55-64
- `packages/server/src/modules/companies/service.ts` lines 66-70
- Contrast with `GET /api/companies` (line 45-48) which correctly uses `getCompaniesForUser(user.id)`

### Severity

MEDIUM — Information disclosure. Any authenticated user can read any company's details (name, slug, mission, timestamps).

### Suggested Area to Inspect

`packages/server/src/modules/companies/routes.ts` — GET /:id handler should verify user has access via `validateCompanyAccess()` from the company-scope middleware, or filter through UserCompany junction table.

---

## Bug 3: POST /api/companies Does Not Create UserCompany Record

### Steps to Reproduce

1. Authenticate as User A
2. Send `POST /api/companies` with `{ "name": "New Co", "slug": "new-co" }`
3. Observe company is created successfully (201)
4. Send `GET /api/companies` to list accessible companies
5. Observe the new company is NOT in the list (unless the stub fallback returns all companies)

### Expected Result

Creating a company should automatically create a UserCompany junction record associating the creating user as OWNER of the new company.

### Actual Result

The `createCompany()` function at `service.ts:75-83` only creates the Company record. No UserCompany record is created. The company is effectively orphaned — no user has membership in it.

```typescript
// Current code — no UserCompany record created
export async function createCompany(data: CreateCompanyInput) {
  return prisma.company.create({
    data: { name: data.name, slug: data.slug, mission: data.mission ?? null },
  });
  // Missing: prisma.userCompany.create({ data: { userId, companyId: company.id, role: 'OWNER' } })
}
```

This is partially masked by the stub fallback in `getCompaniesForUser()` (lines 52-61) which returns ALL companies when no UserCompany records exist for the user. But when real auth is implemented, newly created companies will be inaccessible to their creators.

### Evidence

- `packages/server/src/modules/companies/service.ts` lines 75-83
- `packages/server/src/modules/companies/service.ts` lines 34-61 (getCompaniesForUser fallback masks the issue)
- `packages/server/src/modules/companies/routes.ts` lines 70-76 (route doesn't pass user.id to service)

### Severity

MEDIUM — Data integrity issue. Creates orphaned companies that won't be accessible once stub auth is replaced with real authentication.

### Suggested Area to Inspect

`packages/server/src/modules/companies/service.ts` — `createCompany()` should accept `userId` and create a UserCompany record with OWNER role. `routes.ts` POST handler should pass `user.id` to the service.

---

## Bug 4: listCompanies() Exported Without User Filtering

### Steps to Reproduce

1. Import `listCompanies()` from `companies/service.ts`
2. Call it directly
3. Observe it returns ALL companies across all tenants

### Expected Result

Either `listCompanies()` should be removed (replaced by `getCompaniesForUser()`), or it should require admin authorization.

### Actual Result

`listCompanies()` at `service.ts:18-22` returns all companies via `prisma.company.findMany()` with no user filtering. While it is no longer used in the routes (replaced by `getCompaniesForUser()`), it remains exported and could be accidentally imported by other modules, bypassing multi-tenant isolation.

### Evidence

- `packages/server/src/modules/companies/service.ts` lines 18-22

### Severity

LOW — Code hygiene issue. The function is currently unused in routes but its existence creates a risk of misuse.

### Suggested Area to Inspect

`packages/server/src/modules/companies/service.ts` — Remove or deprecate `listCompanies()`. Add a deprecation comment or delete entirely since `getCompaniesForUser()` is the correct replacement.

---

**Reporter:** QA Engineer
**Date:** 2026-06-05
