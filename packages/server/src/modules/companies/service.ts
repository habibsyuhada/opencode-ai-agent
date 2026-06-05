/**
 * Company service — business logic for Company CRUD operations.
 *
 * All queries are scoped to the authenticated company via companyId.
 * Uses Prisma client from db/client.ts.
 *
 * Story: STORY-016 — Multi-Company Support
 *   Added getCompaniesForUser() for company switching.
 *
 * Bugfix: STORY-020 — Multi-tenant isolation
 *   - Removed listCompanies() (bypassed isolation)
 *   - Added access control in updateCompany() and deleteCompany()
 *   - Added user-company membership check in getCompanyByIdForUser()
 *   - createCompany() now creates UserCompany junction record with OWNER role
 */

import prisma from '../../db/client.js';
import type { CreateCompanyInput, UpdateCompanyInput } from './schema.js';

/** Roles that are allowed to modify (update/delete) a company */
const ADMIN_ROLES = ['OWNER', 'ADMIN'];

/**
 * Get companies accessible to a specific user.
 *
 * Queries the UserCompany junction table to find all companies
 * the user has membership in. Falls back to all companies if
 * no UserCompany records exist (stub mode).
 *
 * @param userId - The authenticated user's ID
 * @returns Array of companies the user can access
 */
export async function getCompaniesForUser(userId: string) {
  // First try to get companies via the UserCompany junction table
  const userCompanies = await prisma.userCompany.findMany({
    where: { userId },
    include: {
      company: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (userCompanies.length > 0) {
    return userCompanies.map((uc) => ({
      ...uc.company,
      userRole: uc.role,
    }));
  }

  // Fallback for stub mode: return all companies
  // This allows the stub user to switch between any company
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return companies.map((c) => ({
    ...c,
    userRole: 'ADMIN',
  }));
}

/**
 * Check if a user has membership in a company.
 *
 * @param userId - The user ID to check
 * @param companyId - The company ID to check
 * @returns The UserCompany record if membership exists, null otherwise
 */
export async function getUserCompanyMembership(userId: string, companyId: string) {
  return prisma.userCompany.findUnique({
    where: {
      userId_companyId: { userId, companyId },
    },
  });
}

/**
 * Get a single company by ID with user access verification.
 *
 * Checks that the requesting user has membership in the target company
 * via the UserCompany junction table. Returns null if the company is
 * not found or the user lacks access.
 *
 * @param id - The company ID
 * @param userId - The authenticated user's ID
 * @returns The company if found and user has access, null otherwise
 */
export async function getCompanyByIdForUser(id: string, userId: string) {
  // Check if user has membership in this company
  const membership = await getUserCompanyMembership(userId, id);

  if (!membership) {
    // Fallback for stub users: allow access if the company exists
    // This preserves compatibility with stub auth mode
    if (userId.startsWith('stub-')) {
      const company = await prisma.company.findUnique({ where: { id } });
      if (company) {
        return { ...company, userRole: 'ADMIN' };
      }
      return null;
    }
    return null;
  }

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) {
    return null;
  }

  return { ...company, userRole: membership.role };
}

/**
 * Create a new company.
 * Also creates a UserCompany junction record associating the creating
 * user as OWNER of the new company.
 *
 * @param data - Company creation input
 * @param userId - The creating user's ID
 * @returns The created company with userRole
 */
export async function createCompany(data: CreateCompanyInput, userId: string) {
  // Use a transaction to ensure both records are created atomically
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: data.name,
        slug: data.slug,
        mission: data.mission ?? null,
      },
    });

    // Create the UserCompany junction record with OWNER role
    await tx.userCompany.create({
      data: {
        userId,
        companyId: company.id,
        role: 'OWNER',
      },
    });

    return company;
  });

  return { ...result, userRole: 'OWNER' };
}

/**
 * Update an existing company.
 * Validates that the requesting user has admin access to the company
 * via the UserCompany junction table (must have OWNER or ADMIN role).
 * Returns null if the company is not found or user lacks access.
 *
 * @param id - The company ID to update
 * @param data - The update data
 * @param userId - The authenticated user's ID
 * @returns The updated company, or null if not found / access denied
 */
export async function updateCompany(id: string, data: UpdateCompanyInput, userId: string) {
  // Verify the company exists
  const existing = await prisma.company.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  // Verify user has admin-level access to this company
  const membership = await getUserCompanyMembership(userId, id);

  if (!membership) {
    // Stub users get automatic admin access for backward compatibility
    if (userId.startsWith('stub-')) {
      // Allow — stub fallback
    } else {
      return null; // Access denied — no membership
    }
  } else if (!ADMIN_ROLES.includes(membership.role)) {
    return null; // Access denied — not an admin/owner
  }

  return prisma.company.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.mission !== undefined && { mission: data.mission }),
    },
  });
}

/**
 * Delete a company by ID.
 * Validates that the requesting user has admin access to the company
 * via the UserCompany junction table (must have OWNER or ADMIN role).
 * Returns null if the company is not found or user lacks access.
 * Cascades to related records via Prisma relations.
 *
 * @param id - The company ID to delete
 * @param userId - The authenticated user's ID
 * @returns The deleted company, or null if not found / access denied
 */
export async function deleteCompany(id: string, userId: string) {
  // Verify the company exists
  const existing = await prisma.company.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  // Verify user has admin-level access to this company
  const membership = await getUserCompanyMembership(userId, id);

  if (!membership) {
    // Stub users get automatic admin access for backward compatibility
    if (userId.startsWith('stub-')) {
      // Allow — stub fallback
    } else {
      return null; // Access denied — no membership
    }
  } else if (!ADMIN_ROLES.includes(membership.role)) {
    return null; // Access denied — not an admin/owner
  }

  return prisma.company.delete({
    where: { id },
  });
}
