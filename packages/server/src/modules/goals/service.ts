/**
 * Goal service — business logic for Goal CRUD operations.
 *
 * Goals are mid-level objectives nested under Projects.
 * All queries are scoped to the authenticated company via project ownership.
 */

import prisma from '../../db/client.js';
import type { CreateGoalInput, UpdateGoalInput, ListGoalsQuery } from './schema.js';

/**
 * List goals with optional filters.
 * Validates that the parent project belongs to the authenticated company.
 */
export async function listGoals(companyId: string, filters?: ListGoalsQuery) {
  return prisma.goal.findMany({
    where: {
      ...(filters?.projectId && { projectId: filters.projectId }),
      ...(filters?.status && { status: filters.status }),
      // Ensure company isolation via project relation
      project: { companyId },
    },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { id: 'desc' },
  });
}

/**
 * Get a single goal by ID.
 * Validates company ownership via the parent project.
 */
export async function getGoalById(id: string, companyId: string) {
  return prisma.goal.findFirst({
    where: {
      id,
      project: { companyId },
    },
    include: {
      project: { select: { id: true, name: true } },
      tasks: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/**
 * Create a new goal under a project.
 * Validates that the parent project belongs to the authenticated company.
 */
export async function createGoal(data: CreateGoalInput, companyId: string) {
  // Verify the project belongs to this company
  const project = await prisma.project.findFirst({
    where: { id: data.projectId, companyId },
  });

  if (!project) {
    return null;
  }

  return prisma.goal.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      status: data.status ?? 'PENDING',
    },
    include: {
      project: { select: { id: true, name: true } },
    },
  });
}

/**
 * Update an existing goal.
 * Validates company ownership via the parent project.
 */
export async function updateGoal(id: string, data: UpdateGoalInput, companyId: string) {
  const existing = await prisma.goal.findFirst({
    where: {
      id,
      project: { companyId },
    },
  });

  if (!existing) {
    return null;
  }

  return prisma.goal.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });
}

/**
 * Delete a goal by ID.
 * Validates company ownership via the parent project.
 * Cascades to tasks via Prisma relations.
 */
export async function deleteGoal(id: string, companyId: string) {
  const existing = await prisma.goal.findFirst({
    where: {
      id,
      project: { companyId },
    },
  });

  if (!existing) {
    return null;
  }

  return prisma.goal.delete({
    where: { id },
  });
}
