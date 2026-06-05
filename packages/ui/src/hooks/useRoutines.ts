/**
 * TanStack Query hooks for Routine data.
 *
 * Connects to the Hono REST API to fetch, create, update, and manage routines.
 * Uses the Hono client from @/lib/api for API calls.
 *
 * Story: STORY-014 — Routines & Scheduling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Routine type matching the Prisma model */
export interface Routine {
  id: string;
  companyId: string;
  agentId?: string | null;
  name: string;
  description?: string | null;
  cron: string;
  action: string;
  enabled: boolean;
  concurrencyPolicy: string;
  catchUpPolicy: string;
  maxConcurrentRuns: number;
  timeoutMs?: number | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { runs: number };
  runs?: RoutineRun[];
}

/** RoutineRun type matching the Prisma model */
export interface RoutineRun {
  id: string;
  routineId: string;
  heartbeatId?: string | null;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
  log?: string | null;
  error?: string | null;
  createdAt: string;
}

/** Routine statistics */
export interface RoutineStats {
  routineId: string;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  skippedRuns: number;
  successRate: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  enabled: boolean;
}

/** Input type for creating a new routine */
export interface CreateRoutineInput {
  agentId?: string;
  name: string;
  description?: string;
  cron: string;
  action: string;
  enabled?: boolean;
  concurrencyPolicy?: 'ALLOW_OVERLAP' | 'SKIP_IF_RUNNING' | 'QUEUE';
  catchUpPolicy?: 'SKIP' | 'RUN_ONCE' | 'RUN_ALL';
  maxConcurrentRuns?: number;
  timeoutMs?: number;
}

/** Input type for updating a routine */
export interface UpdateRoutineInput {
  agentId?: string | null;
  name?: string;
  description?: string;
  cron?: string;
  action?: string;
  enabled?: boolean;
  concurrencyPolicy?: string;
  catchUpPolicy?: string;
  maxConcurrentRuns?: number;
  timeoutMs?: number | null;
}

/**
 * Fetch all routines for the current company.
 */
export function useRoutines(filters?: { agentId?: string; enabled?: boolean }) {
  return useQuery<Routine[]>({
    queryKey: ['routines', filters],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (filters?.agentId) query.agentId = filters.agentId;
      if (filters?.enabled !== undefined) query.enabled = String(filters.enabled);

      const res = await api.api.routines.$get({ query });
      if (!res.ok) throw new Error('Failed to fetch routines');
      const json = await res.json();
      return (json as { data: Routine[] }).data;
    },
  });
}

/**
 * Fetch a single routine by ID, including recent run history.
 */
export function useRoutine(id: string | null) {
  return useQuery<Routine>({
    queryKey: ['routines', id],
    queryFn: async () => {
      if (!id) throw new Error('Routine ID is required');
      const res = await api.api.routines[':id'].$get({ param: { id } });
      if (!res.ok) throw new Error('Failed to fetch routine');
      const json = await res.json();
      return (json as { data: Routine }).data;
    },
    enabled: !!id,
  });
}

/**
 * Fetch run history for a routine.
 */
export function useRoutineRuns(routineId: string | null, filters?: { status?: string }) {
  return useQuery<RoutineRun[]>({
    queryKey: ['routines', routineId, 'runs', filters],
    queryFn: async () => {
      if (!routineId) throw new Error('Routine ID is required');
      const query: Record<string, string> = {};
      if (filters?.status) query.status = filters.status;

      const res = await api.api.routines[':id'].$get({
        param: { id: routineId },
      });
      if (!res.ok) throw new Error('Failed to fetch routine runs');
      const json = await res.json();
      const routine = (json as { data: Routine }).data;
      return routine.runs ?? [];
    },
    enabled: !!routineId,
  });
}

/**
 * Fetch routine statistics.
 */
export function useRoutineStats(routineId: string | null) {
  return useQuery<RoutineStats>({
    queryKey: ['routines', routineId, 'stats'],
    queryFn: async () => {
      if (!routineId) throw new Error('Routine ID is required');
      // Use fetch directly since the hc client may not have the typed route
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${baseUrl}/api/routines/${routineId}/stats`);
      if (!res.ok) throw new Error('Failed to fetch routine stats');
      const json = await res.json();
      return (json as { data: RoutineStats }).data;
    },
    enabled: !!routineId,
  });
}

/**
 * Create a new routine.
 */
export function useCreateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRoutineInput) => {
      const res = await api.api.routines.$post({ json: input });
      if (!res.ok) throw new Error('Failed to create routine');
      const json = await res.json();
      return (json as { data: Routine }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });
}

/**
 * Update an existing routine.
 */
export function useUpdateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateRoutineInput & { id: string }) => {
      const res = await api.api.routines[':id'].$patch({
        param: { id },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update routine');
      const json = await res.json();
      return (json as { data: Routine }).data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      queryClient.invalidateQueries({ queryKey: ['routines', variables.id] });
    },
  });
}

/**
 * Delete a routine.
 */
export function useDeleteRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.routines[':id'].$delete({ param: { id } });
      if (!res.ok) throw new Error('Failed to delete routine');
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });
}

/**
 * Manually trigger a routine execution.
 */
export function useTriggerRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.routines[':id'].trigger.$post({
        param: { id },
        json: {},
      });
      if (!res.ok) throw new Error('Failed to trigger routine');
      const json = await res.json();
      return (json as { data: RoutineRun }).data;
    },
    onSuccess: (_data, routineId) => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      queryClient.invalidateQueries({ queryKey: ['routines', routineId] });
      queryClient.invalidateQueries({ queryKey: ['routines', routineId, 'runs'] });
    },
  });
}

/**
 * Status display helpers
 */
export const ROUTINE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  SKIPPED: 'bg-gray-100 text-gray-600',
};

export const CONCURRENCY_POLICY_LABELS: Record<string, string> = {
  ALLOW_OVERLAP: 'Allow Overlap',
  SKIP_IF_RUNNING: 'Skip if Running',
  QUEUE: 'Queue',
};

export const CATCH_UP_POLICY_LABELS: Record<string, string> = {
  SKIP: 'Skip Missed',
  RUN_ONCE: 'Run Once',
  RUN_ALL: 'Run All Missed',
};
