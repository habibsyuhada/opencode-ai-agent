/**
 * BudgetPage — Full budget visualization and management page.
 *
 * Features:
 * - Company budget overview with summary cards (total, used, remaining, %)
 * - Per-agent spend breakdown (bar chart via Recharts)
 * - Cost timeline (line chart via Recharts)
 * - Cost events table (filterable by model/provider)
 * - Budget settings panel (edit limits, thresholds)
 * - Connected to API via TanStack Query hooks
 * - Empty state handling
 *
 * Story: STORY-013 — Dashboard UI: Budget Visualization
 */

import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  Settings,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  useBudgets,
  useCostEvents,
  useCostTimeline,
  useAgentSpend,
  useUpdateBudget,
  computeBudgetSummary,
  formatCost,
  formatTokens,
} from '@/hooks/useBudgets';
import type { Budget, CostEvent, UpdateBudgetInput } from '@/hooks/useBudgets';

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
}

function SummaryCard({ title, value, subtitle, icon, color, alert }: SummaryCardProps) {
  return (
    <div
      className={`rounded-xl border p-6 shadow-sm ${
        alert
          ? 'border-red-200 bg-red-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className={`mt-1 text-xs ${alert ? 'text-red-600' : 'text-gray-400'}`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`rounded-lg p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

interface BudgetProgressBarProps {
  percentUsed: number;
  threshold: number;
  currency: string;
  totalUsed: number;
  totalBudget: number;
}

function BudgetProgressBar({ percentUsed, threshold, currency, totalUsed, totalBudget }: BudgetProgressBarProps) {
  const isOver = percentUsed / 100 >= threshold;
  const barColor = isOver
    ? 'bg-red-500'
    : percentUsed > 60
    ? 'bg-yellow-500'
    : 'bg-blue-500';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Budget Utilization</h3>
        <span className={`text-sm font-semibold ${isOver ? 'text-red-600' : 'text-gray-900'}`}>
          {percentUsed.toFixed(1)}%
        </span>
      </div>
      <div className="relative h-4 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
          data-testid="budget-progress-bar"
        />
        {/* Threshold marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-400"
          style={{ left: `${threshold * 100}%` }}
          title={`Threshold: ${(threshold * 100).toFixed(0)}%`}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>{formatCost(totalUsed, currency)} used</span>
        <span>{formatCost(totalBudget, currency)} limit</span>
      </div>
      {isOver && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle size={12} />
          Budget threshold exceeded — agents may be auto-paused
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Settings Panel
// ────────────────────────────────────────────────────────────

interface BudgetSettingsProps {
  budgets: Budget[];
  onUpdate: (input: UpdateBudgetInput) => void;
  isUpdating: boolean;
  onClose: () => void;
}

function BudgetSettings({ budgets, onUpdate, isUpdating, onClose }: BudgetSettingsProps) {
  const [editValues, setEditValues] = useState<Record<string, { monthly: string; threshold: string }>>(() => {
    const initial: Record<string, { monthly: string; threshold: string }> = {};
    budgets.forEach((b) => {
      initial[b.id] = {
        monthly: b.monthly.toString(),
        threshold: (b.threshold * 100).toString(),
      };
    });
    return initial;
  });

  const handleSave = (budget: Budget) => {
    const values = editValues[budget.id];
    if (!values) return;
    onUpdate({
      id: budget.id,
      monthly: parseFloat(values.monthly),
      threshold: parseFloat(values.threshold) / 100,
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" data-testid="budget-settings">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Budget Settings</h3>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>

      {budgets.length === 0 ? (
        <p className="text-sm text-gray-500">No budgets configured yet.</p>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="rounded-lg border border-gray-100 p-4"
              data-testid={`budget-setting-${budget.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {budget.agent ? budget.agent.name : 'Company Budget'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {budget.agent ? budget.agent.role : 'Global'} · {budget.currency}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Monthly Limit ({budget.currency})
                  </label>
                  <input
                    type="number"
                    value={editValues[budget.id]?.monthly ?? ''}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [budget.id]: { ...prev[budget.id], monthly: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    data-testid={`budget-monthly-${budget.id}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Alert Threshold (%)
                  </label>
                  <input
                    type="number"
                    value={editValues[budget.id]?.threshold ?? ''}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [budget.id]: { ...prev[budget.id], threshold: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    data-testid={`budget-threshold-${budget.id}`}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => handleSave(budget)}
                  disabled={isUpdating}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  data-testid={`budget-save-${budget.id}`}
                >
                  {isUpdating ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Empty State
// ────────────────────────────────────────────────────────────

function EmptyBudgetState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm text-center">
      <DollarSign size={48} className="mx-auto text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Budget Data</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Budget tracking will appear here once your agents start executing tasks
        and generating cost events. Set up a budget limit in Settings to get started.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────

type PeriodOption = '7d' | '30d' | '90d';

export function BudgetPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [timelinePeriod, setTimelinePeriod] = useState<PeriodOption>('30d');
  const [eventFilter, setEventFilter] = useState<{ model: string; provider: string }>({
    model: '',
    provider: '',
  });

  // Data fetching
  const { data: budgets = [], isLoading: budgetsLoading, error: budgetsError } = useBudgets();
  const { data: costEvents = [], isLoading: eventsLoading } = useCostEvents(
    eventFilter.model || eventFilter.provider ? eventFilter : undefined,
  );
  const { data: timeline = [], isLoading: timelineLoading } = useCostTimeline(timelinePeriod);
  const { data: agentSpend = [], isLoading: agentSpendLoading } = useAgentSpend();
  const updateBudget = useUpdateBudget();

  // Derived data
  const summary = useMemo(() => computeBudgetSummary(budgets), [budgets]);

  // Unique models and providers for filter dropdowns
  const uniqueModels = useMemo(
    () => [...new Set(costEvents.map((e) => e.model))].sort(),
    [costEvents],
  );
  const uniqueProviders = useMemo(
    () => [...new Set(costEvents.map((e) => e.provider))].sort(),
    [costEvents],
  );

  // Loading state
  const isLoading = budgetsLoading && timelineLoading && agentSpendLoading;

  // Error state
  if (budgetsError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-500">Track spending and manage budget limits</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Failed to load budget data. Make sure the API server is running.
          </p>
          <p className="text-xs text-red-500 mt-1">{(budgetsError as Error).message}</p>
        </div>
      </div>
    );
  }

  // Empty state — no budgets and no cost events
  const hasData = budgets.length > 0 || costEvents.length > 0 || timeline.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-500">Track spending and manage budget limits</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            showSettings
              ? 'bg-gray-200 text-gray-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          data-testid="toggle-settings"
        >
          <Settings size={16} />
          {showSettings ? 'Close Settings' : 'Budget Settings'}
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
          <div className="h-80 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-80 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasData && <EmptyBudgetState />}

      {/* Budget Settings panel */}
      {showSettings && (
        <BudgetSettings
          budgets={budgets}
          onUpdate={(input) => updateBudget.mutate(input)}
          isUpdating={updateBudget.isPending}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Summary cards */}
      {!isLoading && hasData && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Total Budget"
              value={formatCost(summary.totalBudget, summary.currency)}
              subtitle="Monthly limit"
              icon={<DollarSign size={24} className="text-blue-600" />}
              color="bg-blue-50"
            />
            <SummaryCard
              title="Used This Month"
              value={formatCost(summary.totalUsed, summary.currency)}
              subtitle={`${summary.percentUsed.toFixed(1)}% of budget`}
              icon={<TrendingUp size={24} className="text-yellow-600" />}
              color="bg-yellow-50"
            />
            <SummaryCard
              title="Remaining"
              value={formatCost(summary.remainingBudget, summary.currency)}
              subtitle={summary.remainingBudget < 0 ? 'Over budget!' : undefined}
              icon={<DollarSign size={24} className={summary.remainingBudget < 0 ? 'text-red-600' : 'text-green-600'} />}
              color={summary.remainingBudget < 0 ? 'bg-red-50' : 'bg-green-50'}
              alert={summary.remainingBudget < 0}
            />
            <SummaryCard
              title="Active Agents"
              value={summary.agentCount.toString()}
              subtitle="With budget allocations"
              icon={<Users size={24} className="text-purple-600" />}
              color="bg-purple-50"
            />
          </div>

          {/* Budget utilization bar */}
          <BudgetProgressBar
            percentUsed={summary.percentUsed}
            threshold={budgets.find((b) => !b.agentId)?.threshold ?? 0.8}
            currency={summary.currency}
            totalUsed={summary.totalUsed}
            totalBudget={summary.totalBudget}
          />
        </>
      )}

      {/* Per-agent spend bar chart */}
      {!isLoading && agentSpend.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spend by Agent</h3>
          <div className="h-72" data-testid="agent-spend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentSpend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="agentName"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCost(value), 'Cost']}
                  labelFormatter={(label) => `Agent: ${label}`}
                />
                <Bar
                  dataKey="totalCost"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="Cost"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cost timeline line chart */}
      {!isLoading && timeline.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Cost Over Time</h3>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
              {(['7d', '30d', '90d'] as PeriodOption[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimelinePeriod(period)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    timelinePeriod === period
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  data-testid={`period-${period}`}
                >
                  {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72" data-testid="cost-timeline-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'cost') return [formatCost(value), 'Cost'];
                    return [formatTokens(value), name === 'tokensIn' ? 'Tokens In' : 'Tokens Out'];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Cost"
                />
                <Line
                  type="monotone"
                  dataKey="tokensIn"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  dot={false}
                  name="Tokens In"
                  yAxisId={0}
                />
                <Line
                  type="monotone"
                  dataKey="tokensOut"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                  name="Tokens Out"
                  yAxisId={0}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cost events table */}
      {!isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Cost Events</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-gray-400" />
                  <select
                    value={eventFilter.provider}
                    onChange={(e) => setEventFilter((f) => ({ ...f, provider: e.target.value }))}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none"
                    data-testid="filter-provider"
                  >
                    <option value="">All Providers</option>
                    {uniqueProviders.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    value={eventFilter.model}
                    onChange={(e) => setEventFilter((f) => ({ ...f, model: e.target.value }))}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none"
                    data-testid="filter-model"
                  >
                    <option value="">All Models</option>
                    {uniqueModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {eventsLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 px-4 py-2 bg-gray-50 border-b">
                {costEvents.length} event{costEvents.length !== 1 ? 's' : ''}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="cost-events-table">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Provider</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Model</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Tokens In</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Tokens Out</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {costEvents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          No cost events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      costEvents.map((event) => (
                        <tr
                          key={event.id}
                          className="hover:bg-gray-50 transition-colors"
                          data-testid={`cost-event-${event.id}`}
                        >
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {new Date(event.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                              {event.provider}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-xs font-mono">
                            {event.model}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 text-xs">
                            {formatTokens(event.tokensIn)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 text-xs">
                            {formatTokens(event.tokensOut)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 text-xs">
                            {formatCost(event.cost)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
