/**
 * Zod schemas for Project validation.
 *
 * Mirrors the Prisma Project model from prisma/schema.prisma.
 */

import { z } from 'zod';

// ── Base schemas ─────────────────────────────────────────────────

/** Schema for creating a new project */
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
});

/** Schema for updating an existing project */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

/** Schema for project ID parameter */
export const projectIdParamSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
});

/** Schema for listing projects with optional filters */
export const listProjectsQuerySchema = z.object({
  companyId: z.string().optional(), // Usually injected by middleware
});

// ── Inferred types ───────────────────────────────────────────────

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectIdParam = z.infer<typeof projectIdParamSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
