/**
 * Zod schemas for Company validation.
 *
 * Mirrors the Prisma Company model from prisma/schema.prisma.
 */

import { z } from 'zod';

// ── Base schemas ─────────────────────────────────────────────────

/** Schema for creating a new company */
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  mission: z.string().max(2000).optional(),
});

/** Schema for updating an existing company */
export const updateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  mission: z.string().max(2000).optional(),
});

/** Schema for company ID parameter */
export const companyIdParamSchema = z.object({
  id: z.string().min(1, 'Company ID is required'),
});

// ── Inferred types ───────────────────────────────────────────────

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CompanyIdParam = z.infer<typeof companyIdParamSchema>;
