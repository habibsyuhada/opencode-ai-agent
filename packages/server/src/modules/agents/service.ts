/**
 * Agent service — business logic for Agent CRUD and org chart operations.
 *
 * All queries are scoped to the authenticated company via companyId.
 * Supports building a tree structure for the org chart visualization.
 */

import prisma from '../../db/client.js';
import type { CreateAgentInput, UpdateAgentInput, ListAgentsQuery } from './schema.js';
import type { Agent, Prisma } from '@prisma/client';

/**
 * Agent with nested reports for the org chart tree.
 */
export interface AgentTreeNode extends Agent {
  reports: AgentTreeNode[];
}

/**
 * List agents with optional filters (role, status, managerId).
 * Scoped to a specific company.
 */
export async function listAgents(companyId: string, filters?: ListAgentsQuery) {
  return prisma.agent.findMany({
    where: {
      companyId,
      ...(filters?.role && { role: filters.role }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.managerId && { managerId: filters.managerId }),
    },
    include: {
      manager: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single agent by ID, scoped to company.
 */
export async function getAgentById(id: string, companyId: string) {
  return prisma.agent.findFirst({
    where: { id, companyId },
    include: {
      manager: { select: { id: true, name: true, role: true } },
      reports: { select: { id: true, name: true, role: true, status: true } },
    },
  });
}

/**
 * Build the org chart tree for a company.
 *
 * Fetches all agents for the company and builds a tree structure
 * based on the managerId self-relation. Root agents have no manager.
 */
export async function getOrgChart(companyId: string): Promise<AgentTreeNode[]> {
  const agents = await prisma.agent.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });

  // Build a map of id → agent node
  const nodeMap = new Map<string, AgentTreeNode>();
  for (const agent of agents) {
    nodeMap.set(agent.id, { ...agent, reports: [] });
  }

  // Build the tree by linking children to parents
  const roots: AgentTreeNode[] = [];
  for (const agent of agents) {
    const node = nodeMap.get(agent.id)!;
    if (agent.managerId && nodeMap.has(agent.managerId)) {
      nodeMap.get(agent.managerId)!.reports.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Create a new agent (hire).
 * Scoped to the authenticated company.
 */
export async function createAgent(data: CreateAgentInput, companyId: string) {
  return prisma.agent.create({
    data: {
      companyId,
      name: data.name,
      role: data.role,
      title: data.title ?? null,
      managerId: data.managerId ?? null,
      status: data.status ?? 'ACTIVE',
      config: (data.config as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

/**
 * Update an existing agent.
 * Scoped to the authenticated company.
 */
export async function updateAgent(id: string, data: UpdateAgentInput, companyId: string) {
  // Verify the agent belongs to this company
  const existing = await prisma.agent.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return null;
  }

  const updateData: Prisma.AgentUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.managerId !== undefined) {
    updateData.manager = data.managerId === null
      ? { disconnect: true }
      : { connect: { id: data.managerId } };
  }
  if (data.status !== undefined) updateData.status = data.status;
  if (data.config !== undefined) updateData.config = data.config as Prisma.InputJsonValue;

  return prisma.agent.update({
    where: { id },
    data: updateData,
  });
}
