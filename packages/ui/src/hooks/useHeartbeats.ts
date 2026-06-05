/**
 * TanStack Query hooks for Heartbeat data.
 *
 * Connects to the Hono RPC API to fetch, poll, and manage heartbeat runs.
 * Uses the Hono client from @/lib/api for type-safe API calls.
 * Supports live polling for running heartbeats.
 *
 * Story: STORY-013 — Dashboard UI: Budget & Heartbeats Views
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Heartbeat status values matching the Prisma schema */
export type HeartbeatStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** Heartbeat type matching the Prisma model with relations */
export interface Heartbeat {
  id: string;
  taskId: string;
  agentId: string;
  status: HeartbeatStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  log?: string | null;
  tokensUsed: number;
  cost: number;
  task?: {
    id: string;
    title: string;
    status: string;
  };
  agent?: {
    id: string;
    name: string;
    role: string;
  };
  costEvents?: {
    id: string;
    provider: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    createdAt: string;
  }[];
}

/** Status badge color mapping for heartbeats */
export function heartbeatStatusColor(status: string): string {
  switch (status) {
    case 'PENDING': return 'bg-gray-100 text-gray-600';
    case 'RUNNING': return 'bg-blue-100 text-blue-700';
    case 'COMPLETED': return 'bg-green-100 text-green-700';
    case 'FAILED': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

/**
 * Fetch all heartbeats, optionally filtered by status or agentId.
 * Polling interval adapts based on whether there are running heartbeats.
 */
export function useHeartbeats(filters?: { status?: string; agentId?: string }) {
  return useQuery<Heartbeat[]>({
    queryKey: ['heartbeats', filters],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (filters?.status) query.status = filters.status;
      if (filters?.agentId) query.agentId = filters.agentId;

      const res = await api.api.heartbeats.$get({ query });
      if (!res.ok) throw new Error('Failed to fetch heartbeats');
      const json = await res.json();
      return (json as { data: Heartbeat[] }).data;
    },
  });
}

/**
 * Fetch a single heartbeat by ID with full details (logs, cost events, etc.).
 */
export function useHeartbeat(id: string | null) {
  return useQuery<Heartbeat>({
    queryKey: ['heartbeats', id],
    queryFn: async () => {
      if (!id) throw new Error('Heartbeat ID is required');
      const res = await api.api.heartbeats[':id'].$get({ param: { id } });
      if (!res.ok) throw new Error('Failed to fetch heartbeat');
      const json = await res.json();
      return (json as { data: Heartbeat }).data;
    },
    enabled: !!id,
  });
}

/**
 * Poll running heartbeats at a fast interval (3 seconds).
 * Only enabled when there are active/pending heartbeats.
 */
export function useRunningHeartbeats() {
  return useQuery<Heartbeat[]>({
    queryKey: ['heartbeats', 'running'],
    queryFn: async () => {
      const res = await api.api.heartbeats.$get({
        query: { status: 'RUNNING' },
      });
      if (!res.ok) throw new Error('Failed to fetch running heartbeats');
      const json = await res.json();
      return (json as { data: Heartbeat[] }).data;
    },
    refetchInterval: 3000, // Poll every 3 seconds
    refetchIntervalInBackground: true,
  });
}

/**
 * Format heartbeat duration from startedAt to endedAt (or now if running).
 */
export function formatDuration(startedAt?: string | null, endedAt?: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
