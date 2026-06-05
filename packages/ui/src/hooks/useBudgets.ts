/**
 * TanStack Query hooks for Budget and Cost data.
 *
 * Connects to the Hono RPC API to fetch budgets, cost events,
 * and aggregated cost data for charting.
 * Uses the Hono client from @/lib/api for type-safe API calls.
 *
 * Story: STORY-013 — Dashboard UI: Budget Visualization
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Budget type matching the Prisma model */
export interface Budget {
  id: string;
  companyId: string;
  agentId?: string | null;
  monthly: number;
  used: number;
  currency: string;
  threshold: number;
  createdAt: string;
  updatedAt: string;
  agent?: {
    id: string;
    name: string;
    role: string;
  } | null;
}

/** CostEvent type matching the Prisma model */
export interface CostEvent {
  id: string;
  heartbeatId: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  createdAt: string;
  heartbeat?: {
    id: string;
    agentId: string;
    agent?: {
      id: string;
      name: string;
      role: string;
    };
  };
}

/** Aggregated cost data point for charts */
export interface CostTimelinePoint {
  date: string;
  cost: number;
  tokensIn: number;
  tokensOut: number;
}

/** Per-agent spend breakdown */
export interface AgentSpend {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  heartbeatCount: number;
}

/** Budget summary for the overview cards */
export interface BudgetSummary {
  totalBudget: number;
  totalUsed: number;
  remainingBudget: number;
  percentUsed: number;
  currency: string;
  agentCount: number;
  costEventCount: number;
  isOverThreshold: boolean;
}

/** Input type for updating a budget */
export interface UpdateBudgetInput {
  id: string;
  monthly?: number;
  threshold?: number;
}

/**
 * Fetch all budgets for the current company.
 */
export function useBudgets() {
  return useQuery<Budget[]>({
    queryKey: ['budgets'],
    queryFn: async () => {
      const res = await api.api.budgets.$get();
      if (!res.ok) throw new Error('Failed to fetch budgets');
      const json = await res.json();
      return (json as { data: Budget[] }).data;
    },
  });
}

/**
 * Fetch all cost events for the current company.
 * Supports optional filtering by model or provider.
 */
export function useCostEvents(filters?: { model?: string; provider?: string }) {
  return useQuery<CostEvent[]>({
    queryKey: ['costEvents', filters],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (filters?.model) query.model = filters.model;
      if (filters?.provider) query.provider = filters.provider;

      const res = await api.api['cost-events'].$get({ query });
      if (!res.ok) throw new Error('Failed to fetch cost events');
      const json = await res.json();
      return (json as { data: CostEvent[] }).data;
    },
  });
}

/**
 * Fetch aggregated cost timeline data for charting.
 * Groups cost events by day for the given period.
 */
export function useCostTimeline(period: '7d' | '30d' | '90d' = '30d') {
  return useQuery<CostTimelinePoint[]>({
    queryKey: ['costTimeline', period],
    queryFn: async () => {
      const res = await api.api.budgets.timeline.$get({
        query: { period },
      });
      if (!res.ok) throw new Error('Failed to fetch cost timeline');
      const json = await res.json();
      return (json as { data: CostTimelinePoint[] }).data;
    },
  });
}

/**
 * Fetch per-agent spend breakdown for bar chart.
 */
export function useAgentSpend() {
  return useQuery<AgentSpend[]>({
    queryKey: ['agentSpend'],
    queryFn: async () => {
      const res = await api.api.budgets['agent-spend'].$get();
      if (!res.ok) throw new Error('Failed to fetch agent spend');
      const json = await res.json();
      return (json as { data: AgentSpend[] }).data;
    },
  });
}

/**
 * Compute budget summary from budgets array.
 * This is a derived computation, not a separate API call.
 */
export function computeBudgetSummary(budgets: Budget[]): BudgetSummary {
  if (budgets.length === 0) {
    return {
      totalBudget: 0,
      totalUsed: 0,
      remainingBudget: 0,
      percentUsed: 0,
      currency: 'USD',
      agentCount: 0,
      costEventCount: 0,
      isOverThreshold: false,
    };
  }

  // Company-level budget (agentId is null)
  const companyBudget = budgets.find((b) => !b.agentId);
  // Agent-level budgets
  const agentBudgets = budgets.filter((b) => b.agentId);

  const totalBudget = companyBudget?.monthly ?? budgets.reduce((sum, b) => sum + b.monthly, 0);
  const totalUsed = companyBudget?.used ?? budgets.reduce((sum, b) => sum + b.used, 0);
  const remainingBudget = totalBudget - totalUsed;
  const percentUsed = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;
  const currency = companyBudget?.currency ?? budgets[0]?.currency ?? 'USD';
  const threshold = companyBudget?.threshold ?? budgets[0]?.threshold ?? 0.8;

  return {
    totalBudget,
    totalUsed,
    remainingBudget,
    percentUsed,
    currency,
    agentCount: agentBudgets.length,
    costEventCount: 0, // Will be populated from cost events query
    isOverThreshold: percentUsed / 100 >= threshold,
  };
}

/**
 * Update a budget's limits or thresholds.
 */
export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateBudgetInput) => {
      const res = await api.api.budgets[':id'].$patch({
        param: { id: input.id },
        json: { monthly: input.monthly, threshold: input.threshold },
      });
      if (!res.ok) throw new Error('Failed to update budget');
      const json = await res.json();
      return (json as { data: Budget }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

/**
 * Format a cost value as currency string.
 */
export function formatCost(cost: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cost);
}

/**
 * Format a large token count with abbreviations (e.g., 1.2K, 3.4M).
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}
