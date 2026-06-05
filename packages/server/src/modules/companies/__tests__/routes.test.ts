/**
 * Tests for company routes — multi-tenant isolation at the HTTP layer.
 *
 * Verifies that:
 * - GET /api/companies/:id verifies user-company membership
 * - POST /api/companies creates UserCompany junction record
 * - PATCH /api/companies/:id enforces access control
 * - DELETE /api/companies/:id enforces access control
 *
 * Story: STORY-020 — End-to-End System Polish & QA (Bugfix)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';

// Mock prisma
vi.mock('../../../db/client.js', () => ({
  default: {
    company: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userCompany: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../../db/client.js';
import companies from '../routes.js';

const mockCompanyFindUnique = vi.mocked(prisma.company.findUnique);
const mockCompanyFindMany = vi.mocked(prisma.company.findMany);
const mockCompanyUpdate = vi.mocked(prisma.company.update);
const mockCompanyDelete = vi.mocked(prisma.company.delete);
const mockUserCompanyFindMany = vi.mocked(prisma.userCompany.findMany);
const mockUserCompanyFindUnique = vi.mocked(prisma.userCompany.findUnique);
const mockTransaction = vi.mocked(prisma.$transaction);

/**
 * Build a test Hono app with simulated auth middleware.
 */
function buildTestApp() {
  return new Hono()
    .use('*', async (c, next) => {
      const userId = c.req.header('X-Test-User-Id') || 'stub-user-001';
      const companyId = c.req.header('X-Test-Company-Id') || 'company-a';
      c.set('user', {
        id: userId,
        companyId,
        companyIds: [companyId],
        role: 'ADMIN',
      });
      await next();
    })
    .route('/api/companies', companies);
}

const COMPANY_A = { id: 'company-a', name: 'Company A', slug: 'company-a', mission: null, createdAt: new Date(), updatedAt: new Date() };
const COMPANY_B = { id: 'company-b', name: 'Company B', slug: 'company-b', mission: null, createdAt: new Date(), updatedAt: new Date() };

// ── GET /api/companies/:id ────────────────────────────────────

describe('GET /api/companies/:id — membership verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return company when user has membership', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: 'stub-user-001', companyId: 'company-a', role: 'OWNER' } as any);
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);

    const res = await client.api.companies['company-a'].$get();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.id).toBe('company-a');
  });

  it('should return 404 when user has no membership and is not a stub user', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockUserCompanyFindUnique.mockResolvedValueOnce(null);

    const res = await client.api.companies['company-b'].$get({
      headers: { 'X-Test-User-Id': 'real-user-1' },
    });
    expect(res.status).toBe(404);
  });

  it('should allow stub users to access any company (backward compatibility)', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockUserCompanyFindUnique.mockResolvedValueOnce(null);
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_B as any);

    const res = await client.api.companies['company-b'].$get();
    expect(res.status).toBe(200);
  });

  it('should return 404 when company does not exist', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockUserCompanyFindUnique.mockResolvedValueOnce(null);
    mockCompanyFindUnique.mockResolvedValueOnce(null);

    const res = await client.api.companies['non-existent'].$get();
    expect(res.status).toBe(404);
  });
});

// ── POST /api/companies ────────────────────────────────────────

describe('POST /api/companies — UserCompany junction record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create company and UserCompany record with OWNER role', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    const newCompany = { id: 'new-co', name: 'New Co', slug: 'new-co', mission: null, createdAt: new Date(), updatedAt: new Date() };

    mockTransaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        company: {
          create: vi.fn().mockResolvedValueOnce(newCompany),
        },
        userCompany: {
          create: vi.fn().mockResolvedValueOnce({ userId: 'stub-user-001', companyId: 'new-co', role: 'OWNER' }),
        },
      };
      return callback(mockTx);
    });

    const res = await client.api.companies.$post({
      json: { name: 'New Co', slug: 'new-co' },
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.data.id).toBe('new-co');
    expect(body.data.userRole).toBe('OWNER');
    expect(mockTransaction).toHaveBeenCalled();
  });
});

// ── PATCH /api/companies/:id ────────────────────────────────────

describe('PATCH /api/companies/:id — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow OWNER to update company', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: 'stub-user-001', companyId: 'company-a', role: 'OWNER' } as any);
    mockCompanyUpdate.mockResolvedValueOnce({ ...COMPANY_A, name: 'Updated' } as any);

    const res = await client.api.companies['company-a'].$patch({
      json: { name: 'Updated' },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.name).toBe('Updated');
  });

  it('should deny MEMBER from updating company', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: 'real-user-1', companyId: 'company-a', role: 'MEMBER' } as any);

    const res = await client.api.companies['company-a'].$patch({
      json: { name: 'Hacked' },
      headers: { 'X-Test-User-Id': 'real-user-1' },
    });

    expect(res.status).toBe(404); // Service returns null → route returns 404
  });

  it('should deny user with no membership from updating company', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);

    const res = await client.api.companies['company-a'].$patch({
      json: { name: 'Hacked' },
      headers: { 'X-Test-User-Id': 'real-user-1' },
    });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/companies/:id ───────────────────────────────────

describe('DELETE /api/companies/:id — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow OWNER to delete company', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: 'stub-user-001', companyId: 'company-a', role: 'OWNER' } as any);
    mockCompanyDelete.mockResolvedValueOnce(COMPANY_A as any);

    const res = await client.api.companies['company-a'].$delete();
    expect(res.status).toBe(200);
  });

  it('should deny MEMBER from deleting company', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: 'real-user-1', companyId: 'company-a', role: 'MEMBER' } as any);

    const res = await client.api.companies['company-a'].$delete({
      headers: { 'X-Test-User-Id': 'real-user-1' },
    });

    expect(res.status).toBe(404);
  });

  it('should deny user with no membership from deleting company', async () => {
    const app = buildTestApp();
    const client = testClient(app);

    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);

    const res = await client.api.companies['company-a'].$delete({
      headers: { 'X-Test-User-Id': 'real-user-1' },
    });

    expect(res.status).toBe(404);
  });
});

// ── listCompanies removed ──────────────────────────────────────

describe('listCompanies — not in routes', () => {
  it('should not import listCompanies in routes', async () => {
    const routesModule = await import('../routes.js');
    // The routes module should not expose listCompanies
    // This is a code-level check — the function was removed from service.ts
    const serviceModule = await import('../service.js');
    expect((serviceModule as any).listCompanies).toBeUndefined();
  });
});
