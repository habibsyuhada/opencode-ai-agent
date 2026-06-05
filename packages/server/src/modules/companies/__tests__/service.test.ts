/**
 * Tests for company service — multi-tenant isolation.
 *
 * Verifies that:
 * - updateCompany() enforces access control via UserCompany junction table
 * - deleteCompany() enforces access control via UserCompany junction table
 * - getCompanyByIdForUser() verifies user-company membership
 * - createCompany() creates UserCompany junction record with OWNER role
 * - listCompanies() is no longer exported (isolation bypass removed)
 *
 * Story: STORY-020 — End-to-End System Polish & QA (Bugfix)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import {
  getCompaniesForUser,
  getCompanyByIdForUser,
  createCompany,
  updateCompany,
  deleteCompany,
  getUserCompanyMembership,
} from '../service.js';

// Type-safe mock references
const mockCompanyFindUnique = vi.mocked(prisma.company.findUnique);
const mockCompanyFindMany = vi.mocked(prisma.company.findMany);
const mockCompanyCreate = vi.mocked(prisma.company.create);
const mockCompanyUpdate = vi.mocked(prisma.company.update);
const mockCompanyDelete = vi.mocked(prisma.company.delete);
const mockUserCompanyFindMany = vi.mocked(prisma.userCompany.findMany);
const mockUserCompanyFindUnique = vi.mocked(prisma.userCompany.findUnique);
const mockUserCompanyCreate = vi.mocked(prisma.userCompany.create);
const mockTransaction = vi.mocked(prisma.$transaction);

// ── Helpers ───────────────────────────────────────────────────

const COMPANY_A = { id: 'company-a', name: 'Company A', slug: 'company-a', mission: null, createdAt: new Date(), updatedAt: new Date() };
const COMPANY_B = { id: 'company-b', name: 'Company B', slug: 'company-b', mission: null, createdAt: new Date(), updatedAt: new Date() };
const USER_1 = 'user-1';
const USER_2 = 'user-2';
const STUB_USER = 'stub-user-001';

// ── getCompaniesForUser ──────────────────────────────────────

describe('getCompaniesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return companies from UserCompany junction table when records exist', async () => {
    mockUserCompanyFindMany.mockResolvedValueOnce([
      { userId: USER_1, companyId: 'company-a', role: 'OWNER', company: COMPANY_A, createdAt: new Date() },
    ] as any);

    const result = await getCompaniesForUser(USER_1);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('company-a');
    expect(result[0].userRole).toBe('OWNER');
    expect(mockUserCompanyFindMany).toHaveBeenCalledWith({
      where: { userId: USER_1 },
      include: { company: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('should fall back to all companies for stub users with no UserCompany records', async () => {
    mockUserCompanyFindMany.mockResolvedValueOnce([]);
    mockCompanyFindMany.mockResolvedValueOnce([COMPANY_A, COMPANY_B]);

    const result = await getCompaniesForUser(STUB_USER);

    expect(result).toHaveLength(2);
    expect(result[0].userRole).toBe('ADMIN');
  });
});

// ── getUserCompanyMembership ──────────────────────────────────

describe('getUserCompanyMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return membership record when user belongs to company', async () => {
    const membership = { userId: USER_1, companyId: 'company-a', role: 'OWNER' };
    mockUserCompanyFindUnique.mockResolvedValueOnce(membership as any);

    const result = await getUserCompanyMembership(USER_1, 'company-a');

    expect(result).toEqual(membership);
    expect(mockUserCompanyFindUnique).toHaveBeenCalledWith({
      where: {
        userId_companyId: { userId: USER_1, companyId: 'company-a' },
      },
    });
  });

  it('should return null when user does not belong to company', async () => {
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);

    const result = await getUserCompanyMembership(USER_2, 'company-a');

    expect(result).toBeNull();
  });
});

// ── getCompanyByIdForUser ─────────────────────────────────────

describe('getCompanyByIdForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return company with userRole when user has membership', async () => {
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: USER_1, companyId: 'company-a', role: 'MEMBER' } as any);
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);

    const result = await getCompanyByIdForUser('company-a', USER_1);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('company-a');
    expect(result!.userRole).toBe('MEMBER');
  });

  it('should return null when user has no membership and is not a stub user', async () => {
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);

    const result = await getCompanyByIdForUser('company-a', USER_1);

    expect(result).toBeNull();
    // Should NOT have queried the company table since user has no access
    expect(mockCompanyFindUnique).not.toHaveBeenCalled();
  });

  it('should allow stub users to access existing companies via fallback', async () => {
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);

    const result = await getCompanyByIdForUser('company-a', STUB_USER);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('company-a');
    expect(result!.userRole).toBe('ADMIN');
  });

  it('should return null for stub users when company does not exist', async () => {
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);
    mockCompanyFindUnique.mockResolvedValueOnce(null);

    const result = await getCompanyByIdForUser('non-existent', STUB_USER);

    expect(result).toBeNull();
  });

  it('should return null when membership exists but company was deleted', async () => {
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: USER_1, companyId: 'company-a', role: 'OWNER' } as any);
    mockCompanyFindUnique.mockResolvedValueOnce(null);

    const result = await getCompanyByIdForUser('company-a', USER_1);

    expect(result).toBeNull();
  });
});

// ── createCompany ─────────────────────────────────────────────

describe('createCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create company and UserCompany junction record with OWNER role', async () => {
    const input = { name: 'New Co', slug: 'new-co' };

    // Mock the transaction to execute the callback with a mock transaction client
    mockTransaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        company: {
          create: vi.fn().mockResolvedValueOnce({ id: 'new-company', ...input, mission: null, createdAt: new Date(), updatedAt: new Date() }),
        },
        userCompany: {
          create: vi.fn().mockResolvedValueOnce({ userId: USER_1, companyId: 'new-company', role: 'OWNER' }),
        },
      };
      return callback(mockTx);
    });

    const result = await createCompany(input, USER_1);

    expect(result.id).toBe('new-company');
    expect(result.userRole).toBe('OWNER');
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('should include mission when provided', async () => {
    const input = { name: 'New Co', slug: 'new-co', mission: 'World domination' };

    mockTransaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        company: {
          create: vi.fn().mockResolvedValueOnce({ id: 'new-company', ...input, createdAt: new Date(), updatedAt: new Date() }),
        },
        userCompany: {
          create: vi.fn().mockResolvedValueOnce({ userId: USER_1, companyId: 'new-company', role: 'OWNER' }),
        },
      };
      return callback(mockTx);
    });

    const result = await createCompany(input, USER_1);

    expect(result.id).toBe('new-company');
    expect(result.userRole).toBe('OWNER');
  });
});

// ── updateCompany — Access Control ───────────────────────────

describe('updateCompany — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow OWNER to update company', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: USER_1, companyId: 'company-a', role: 'OWNER' } as any);
    mockCompanyUpdate.mockResolvedValueOnce({ ...COMPANY_A, name: 'Updated' } as any);

    const result = await updateCompany('company-a', { name: 'Updated' }, USER_1);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Updated');
    expect(mockCompanyUpdate).toHaveBeenCalled();
  });

  it('should allow ADMIN to update company', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: USER_1, companyId: 'company-a', role: 'ADMIN' } as any);
    mockCompanyUpdate.mockResolvedValueOnce({ ...COMPANY_A, name: 'Updated' } as any);

    const result = await updateCompany('company-a', { name: 'Updated' }, USER_1);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Updated');
  });

  it('should deny MEMBER from updating company', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: USER_1, companyId: 'company-a', role: 'MEMBER' } as any);

    const result = await updateCompany('company-a', { name: 'Hacked' }, USER_1);

    expect(result).toBeNull();
    expect(mockCompanyUpdate).not.toHaveBeenCalled();
  });

  it('should deny user with no membership from updating company', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);

    const result = await updateCompany('company-a', { name: 'Hacked' }, USER_2);

    expect(result).toBeNull();
    expect(mockCompanyUpdate).not.toHaveBeenCalled();
  });

  it('should return null when company does not exist', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(null);

    const result = await updateCompany('non-existent', { name: 'Updated' }, USER_1);

    expect(result).toBeNull();
    expect(mockUserCompanyFindUnique).not.toHaveBeenCalled();
  });

  it('should allow stub users to update companies (backward compatibility)', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);
    mockCompanyUpdate.mockResolvedValueOnce({ ...COMPANY_A, name: 'Updated' } as any);

    const result = await updateCompany('company-a', { name: 'Updated' }, STUB_USER);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Updated');
  });
});

// ── deleteCompany — Access Control ───────────────────────────

describe('deleteCompany — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow OWNER to delete company', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: USER_1, companyId: 'company-a', role: 'OWNER' } as any);
    mockCompanyDelete.mockResolvedValueOnce(COMPANY_A as any);

    const result = await deleteCompany('company-a', USER_1);

    expect(result).not.toBeNull();
    expect(mockCompanyDelete).toHaveBeenCalled();
  });

  it('should allow ADMIN to delete company', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: USER_1, companyId: 'company-a', role: 'ADMIN' } as any);
    mockCompanyDelete.mockResolvedValueOnce(COMPANY_A as any);

    const result = await deleteCompany('company-a', USER_1);

    expect(result).not.toBeNull();
  });

  it('should deny MEMBER from deleting company', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce({ userId: USER_1, companyId: 'company-a', role: 'MEMBER' } as any);

    const result = await deleteCompany('company-a', USER_1);

    expect(result).toBeNull();
    expect(mockCompanyDelete).not.toHaveBeenCalled();
  });

  it('should deny user with no membership from deleting company', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);

    const result = await deleteCompany('company-a', USER_2);

    expect(result).toBeNull();
    expect(mockCompanyDelete).not.toHaveBeenCalled();
  });

  it('should return null when company does not exist', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(null);

    const result = await deleteCompany('non-existent', USER_1);

    expect(result).toBeNull();
    expect(mockUserCompanyFindUnique).not.toHaveBeenCalled();
  });

  it('should allow stub users to delete companies (backward compatibility)', async () => {
    mockCompanyFindUnique.mockResolvedValueOnce(COMPANY_A as any);
    mockUserCompanyFindUnique.mockResolvedValueOnce(null);
    mockCompanyDelete.mockResolvedValueOnce(COMPANY_A as any);

    const result = await deleteCompany('company-a', STUB_USER);

    expect(result).not.toBeNull();
  });
});

// ── listCompanies removed ─────────────────────────────────────

describe('listCompanies — removed', () => {
  it('should not be exported from service module', async () => {
    const serviceModule = await import('../service.js');
    expect((serviceModule as any).listCompanies).toBeUndefined();
  });
});
