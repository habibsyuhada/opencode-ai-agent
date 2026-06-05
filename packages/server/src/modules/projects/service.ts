/**
 * Project service — business logic for Project CRUD operations.
 *
 * All queries are scoped to the authenticated company via companyId.
 */

import prisma from '../../db/client.js';
import type { CreateProjectInput, UpdateProjectInput } from './schema.js';

/**
 * List all projects for a company.
 * Includes nested goals count for dashboard summary.
 */
export async function listProjects(companyId: string) {
  return prisma.project.findMany({
    where: { companyId },
    include: {
      _count: { select: { goals: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single project by ID, scoped to company.
 * Includes nested goals.
 */
export async function getProjectById(id: string, companyId: string) {
  return prisma.project.findFirst({
    where: { id, companyId },
    include: {
      goals: {
        include: {
          _count: { select: { tasks: true } },
        },
      },
    },
  });
}

/**
 * Create a new project.
 * Scoped to the authenticated company.
 */
export async function createProject(data: CreateProjectInput, companyId: string) {
  return prisma.project.create({
    data: {
      companyId,
      name: data.name,
    },
  });
}

/**
 * Update an existing project.
 * Scoped to the authenticated company.
 */
export async function updateProject(id: string, data: UpdateProjectInput, companyId: string) {
  const existing = await prisma.project.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return null;
  }

  return prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
    },
  });
}

/**
 * Delete a project by ID.
 * Scoped to the authenticated company.
 * Cascades to goals and tasks via Prisma relations.
 */
export async function deleteProject(id: string, companyId: string) {
  const existing = await prisma.project.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return null;
  }

  return prisma.project.delete({
    where: { id },
  });
}
