/**
 * TanStack Query hooks for Agent data.
 *
 * Connects to the Hono RPC API to fetch, create, update, and manage agents.
 * Uses the Hono client from @/lib/api for type-safe API calls.
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Agent type matching the Prisma model */
export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title?: string | null;
  managerId?: string | null;
  status: string;
  config?: Record<string, unknown> | null;
  createdAt: string;
  manager?: Agent | null;
  reports?: Agent[];
  _count?: {
    tasks: number;
    heartbeats: number;
  };
}

/** Role template for hiring agents */
export interface RoleTemplate {
  role: string;
  title: string;
  description: string;
  defaultConfig: Record<string, unknown>;
}

/** Input type for creating a new agent */
export interface CreateAgentInput {
  name: string;
  role: string;
  title?: string;
  managerId?: string;
  config?: Record<string, unknown>;
}

/** Input type for updating an agent */
export interface UpdateAgentInput {
  name?: string;
  role?: string;
  title?: string;
  managerId?: string | null;
  status?: string;
  config?: Record<string, unknown>;
}

/**
 * Fetch all agents for the current company.
 * Supports optional filtering by role and status.
 */
export function useAgents(filters?: { role?: string; status?: string }) {
  return useQuery<Agent[]>({
    queryKey: ['agents', filters],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (filters?.role) query.role = filters.role;
      if (filters?.status) query.status = filters.status;

      const res = await api.api.agents.$get({ query });
      if (!res.ok) throw new Error('Failed to fetch agents');
      const json = await res.json();
      return (json as { data: Agent[] }).data;
    },
  });
}

/**
 * Fetch a single agent by ID, including reports and heartbeat count.
 */
export function useAgent(id: string | null) {
  return useQuery<Agent>({
    queryKey: ['agents', id],
    queryFn: async () => {
      if (!id) throw new Error('Agent ID is required');
      const res = await api.api.agents[':id'].$get({ param: { id } });
      if (!res.ok) throw new Error('Failed to fetch agent');
      const json = await res.json();
      return (json as { data: Agent }).data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new agent (hire agent).
 */
export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAgentInput) => {
      const res = await api.api.agents.$post({ json: input });
      if (!res.ok) throw new Error('Failed to create agent');
      const json = await res.json();
      return (json as { data: Agent }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

/**
 * Update an existing agent (edit config, change status, etc.).
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAgentInput & { id: string }) => {
      const res = await api.api.agents[':id'].$patch({
        param: { id },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update agent');
      const json = await res.json();
      return (json as { data: Agent }).data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agents', variables.id] });
    },
  });
}

/**
 * Predefined role templates for the "Hire Agent" form.
 * These mirror the seed data from the Prisma migration of legacy opencode.json templates.
 */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    role: 'ceo',
    title: 'Chief Executive Officer',
    description: 'Oversees the entire AI team, sets strategic direction, and approves major decisions.',
    defaultConfig: { model: 'claude-sonnet-4-20250514', maxTokens: 4096 },
  },
  {
    role: 'cto',
    title: 'Chief Technology Officer',
    description: 'Defines technical architecture, reviews code quality, and manages the developer team.',
    defaultConfig: { model: 'claude-sonnet-4-20250514', maxTokens: 4096 },
  },
  {
    role: 'scrum-master',
    title: 'Scrum Master',
    description: 'Manages sprints, assigns tasks, tracks progress, and removes blockers.',
    defaultConfig: { model: 'claude-sonnet-4-20250514', maxTokens: 4096 },
  },
  {
    role: 'developer',
    title: 'Software Developer',
    description: 'Writes code, implements features, fixes bugs, and creates pull requests.',
    defaultConfig: { model: 'claude-sonnet-4-20250514', maxTokens: 8192 },
  },
  {
    role: 'qa-engineer',
    title: 'QA Engineer',
    description: 'Writes tests, performs code review, validates features, and reports issues.',
    defaultConfig: { model: 'claude-sonnet-4-20250514', maxTokens: 4096 },
  },
  {
    role: 'devops',
    title: 'DevOps Engineer',
    description: 'Manages deployments, CI/CD pipelines, infrastructure, and monitoring.',
    defaultConfig: { model: 'claude-sonnet-4-20250514', maxTokens: 4096 },
  },
];
