/**
 * TanStack Query hooks for ActivityEvent data.
 *
 * Connects to the Hono RPC API to fetch activity feed and statistics.
 * Used by the ActivityPage to display the audit log.
 *
 * Story: STORY-020 — End-to-End System Polish & QA
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** ActivityEvent type matching the Prisma model */
export interface ActivityEvent {
  id: string;
  companyId: string;
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

/** Activity statistics */
export interface ActivityStats {
  total: number;
  byAction: Array<{ action: string; count: number }>;
  byActorType: Array<{ actorType: string; count: number }>;
}

/** Action color mapping for activity events */
export const ACTION_COLORS: Record<string, string> = {
  TASK_CREATE: 'bg-green-100 text-green-700',
  TASK_UPDATE: 'bg-blue-100 text-blue-700',
  TASK_DELETE: 'bg-red-100 text-red-700',
  TASK_CHECKOUT: 'bg-yellow-100 text-yellow-700',
  TASK_RELEASE: 'bg-purple-100 text-purple-700',
  TASK_ASSIGN: 'bg-indigo-100 text-indigo-700',
  TASK_COMMENT: 'bg-gray-100 text-gray-700',
  TASK_STATUS_CHANGE: 'bg-orange-100 text-orange-700',
  AGENT_CREATE: 'bg-green-100 text-green-700',
  AGENT_UPDATE: 'bg-blue-100 text-blue-700',
  HEARTBEAT_START: 'bg-cyan-100 text-cyan-700',
  HEARTBEAT_COMPLETE: 'bg-green-100 text-green-700',
  HEARTBEAT_FAIL: 'bg-red-100 text-red-700',
  APPROVAL_REQUEST: 'bg-yellow-100 text-yellow-700',
  APPROVAL_DECISION: 'bg-purple-100 text-purple-700',
  BUDGET_CREATE: 'bg-green-100 text-green-700',
  BUDGET_UPDATE: 'bg-blue-100 text-blue-700',
  SECRET_CREATE: 'bg-green-100 text-green-700',
  SECRET_DELETE: 'bg-red-100 text-red-700',
  ROUTINE_CREATE: 'bg-green-100 text-green-700',
  ROUTINE_RUN: 'bg-cyan-100 text-cyan-700',
};

/** Actor type color mapping */
export const ACTOR_TYPE_COLORS: Record<string, string> = {
  USER: 'bg-blue-100 text-blue-700',
  AGENT: 'bg-purple-100 text-purple-700',
  SYSTEM: 'bg-gray-100 text-gray-700',
};

/** Actor type icon labels */
export const ACTOR_TYPE_LABELS: Record<string, string> = {
  USER: 'User',
  AGENT: 'Agent',
  SYSTEM: 'System',
};

/**
 * Format action name for display (e.g., TASK_CHECKOUT → Task Checkout)
 */
export function formatAction(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Fetch activity events with optional filters.
 */
export function useActivityEvents(filters?: {
  actorType?: string;
  action?: string;
  targetType?: string;
  limit?: number;
}) {
  return useQuery<ActivityEvent[]>({
    queryKey: ['activity', filters],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (filters?.actorType) query.actorType = filters.actorType;
      if (filters?.action) query.action = filters.action;
      if (filters?.targetType) query.targetType = filters.targetType;
      if (filters?.limit) query.limit = filters.limit.toString();

      const res = await api.api.activity.$get({ query });
      if (!res.ok) throw new Error('Failed to fetch activity events');
      const json = await res.json();
      return (json as { data: ActivityEvent[] }).data;
    },
  });
}

/**
 * Fetch activity feed — recent activity across the company.
 */
export function useActivityFeed(options?: {
  limit?: number;
  actions?: string[];
  actorTypes?: string[];
}) {
  return useQuery<ActivityEvent[]>({
    queryKey: ['activity', 'feed', options],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (options?.limit) query.limit = options.limit.toString();
      if (options?.actions?.length) query.actions = options.actions.join(',');
      if (options?.actorTypes?.length) query.actorTypes = options.actorTypes.join(',');

      const res = await api.api.activity.feed.$get({ query });
      if (!res.ok) throw new Error('Failed to fetch activity feed');
      const json = await res.json();
      return (json as { data: ActivityEvent[] }).data;
    },
  });
}

/**
 * Fetch activity statistics for the dashboard.
 */
export function useActivityStats() {
  return useQuery<ActivityStats>({
    queryKey: ['activity', 'stats'],
    queryFn: async () => {
      const res = await api.api.activity.stats.$get();
      if (!res.ok) throw new Error('Failed to fetch activity stats');
      const json = await res.json();
      return (json as { data: ActivityStats }).data;
    },
  });
}
