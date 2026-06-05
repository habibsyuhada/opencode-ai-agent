/**
 * HeartbeatsPage — Full heartbeat monitoring and history page.
 *
 * Features:
 * - Running heartbeats section with live polling (3s interval)
 * - Heartbeat history table with status filters
 * - Heartbeat detail panel (logs, cost breakdown, result)
 * - Status badges and duration formatting
 * - Empty state handling
 * - Connected to API via TanStack Query hooks
 *
 * Story: STORY-013 — Dashboard UI: Budget & Heartbeats Views
 */

import React, { useState } from 'react';
import {
  Activity,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  X,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import {
  useHeartbeats,
  useHeartbeat,
  useRunningHeartbeats,
  heartbeatStatusColor,
  formatDuration,
} from '@/hooks/useHeartbeats';
import type { Heartbeat, HeartbeatStatus } from '@/hooks/useHeartbeats';
import { formatCost, formatTokens } from '@/hooks/useBudgets';
import { HeartbeatLogs } from '@/components/HeartbeatLogs';

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

/** Status icon for a heartbeat */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'RUNNING':
      return <Play size={16} className="text-blue-500 animate-pulse" />;
    case 'COMPLETED':
      return <CheckCircle size={16} className="text-green-500" />;
    case 'FAILED':
      return <XCircle size={16} className="text-red-500" />;
    case 'PENDING':
      return <Clock size={16} className="text-gray-400" />;
    default:
      return <Activity size={16} className="text-gray-400" />;
  }
}

/** Running heartbeat card with live indicator */
function RunningHeartbeatCard({
  heartbeat,
  onClick,
}: {
  heartbeat: Heartbeat;
  onClick: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 p-4 cursor-pointer hover:bg-blue-100 transition-colors"
      onClick={onClick}
      data-testid={`running-heartbeat-${heartbeat.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <span className="text-sm font-medium text-blue-900">Running</span>
        </div>
        <span className="text-xs text-blue-600">
          {formatDuration(heartbeat.startedAt)}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900 truncate">
        {heartbeat.task?.title ?? heartbeat.taskId}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {heartbeat.agent?.name ?? heartbeat.agentId}
        {heartbeat.agent?.role && ` · ${heartbeat.agent.role}`}
      </p>
      {heartbeat.tokensUsed > 0 && (
        <p className="text-xs text-blue-600 mt-1">
          {formatTokens(heartbeat.tokensUsed)} tokens · {formatCost(heartbeat.cost)}
        </p>
      )}
    </div>
  );
}

/** Heartbeat detail panel */
function HeartbeatDetail({
  heartbeatId,
  onClose,
}: {
  heartbeatId: string;
  onClose: () => void;
}) {
  const { data: heartbeat, isLoading, error } = useHeartbeat(heartbeatId);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" data-testid="heartbeat-detail-loading">
        <div className="space-y-3">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="h-32 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !heartbeat) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-700">Failed to load heartbeat details.</p>
          <button onClick={onClose} className="text-red-500 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" data-testid="heartbeat-detail">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <StatusIcon status={heartbeat.status} />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {heartbeat.task?.title ?? heartbeat.taskId}
            </h3>
            <p className="text-xs text-gray-500">
              {heartbeat.agent?.name ?? heartbeat.agentId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${heartbeatStatusColor(heartbeat.status)}`}>
            {heartbeat.status}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            data-testid="close-detail"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500">Started</p>
          <p className="text-sm font-medium text-gray-900">
            {heartbeat.startedAt
              ? new Date(heartbeat.startedAt).toLocaleString()
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-sm font-medium text-gray-900">
            {formatDuration(heartbeat.startedAt, heartbeat.endedAt)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tokens Used</p>
          <p className="text-sm font-medium text-gray-900">
            {formatTokens(heartbeat.tokensUsed)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Cost</p>
          <p className="text-sm font-medium text-gray-900">
            {formatCost(heartbeat.cost)}
          </p>
        </div>
      </div>

      {/* Cost events breakdown */}
      {heartbeat.costEvents && heartbeat.costEvents.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wider">
            Cost Breakdown
          </h4>
          <div className="space-y-1.5">
            {heartbeat.costEvents.map((ce) => (
              <div
                key={ce.id}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 font-mono">
                    {ce.model}
                  </span>
                  <span className="text-gray-400">{ce.provider}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <span>{formatTokens(ce.tokensIn)} in / {formatTokens(ce.tokensOut)} out</span>
                  <span className="font-medium text-gray-900">{formatCost(ce.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log output — STORY-019: Real-time streaming logs */}
      <HeartbeatLogs
        heartbeatId={heartbeatId}
        enabled={true}
      />
    </div>
  );
}

/** Empty state for when no heartbeats exist */
function EmptyHeartbeatsState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm text-center">
      <Activity size={48} className="mx-auto text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Heartbeat Runs</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Heartbeat runs will appear here once agents start executing tasks.
        Each heartbeat represents a single execution cycle.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────

type StatusFilter = '' | HeartbeatStatus;

export function HeartbeatsPage() {
  const [selectedHeartbeatId, setSelectedHeartbeatId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const {
    data: heartbeats = [],
    isLoading,
    error,
  } = useHeartbeats(statusFilter ? { status: statusFilter } : undefined);

  const { data: runningHeartbeats = [] } = useRunningHeartbeats();

  // Filter heartbeats by search query
  const filteredHeartbeats = heartbeats.filter((hb) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      hb.task?.title?.toLowerCase().includes(q) ||
      hb.agent?.name?.toLowerCase().includes(q) ||
      hb.agent?.role?.toLowerCase().includes(q) ||
      hb.taskId.toLowerCase().includes(q) ||
      hb.agentId.toLowerCase().includes(q)
    );
  });

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Heartbeats</h1>
          <p className="text-gray-500">Monitor agent execution runs and logs</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Failed to load heartbeat data. Make sure the API server is running.
          </p>
          <p className="text-xs text-red-500 mt-1">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  // Check if there's any data
  const hasData = heartbeats.length > 0 || runningHeartbeats.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Heartbeats</h1>
        <p className="text-gray-500">Monitor agent execution runs and logs</p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Running heartbeats (live polling) */}
      {runningHeartbeats.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
            </span>
            <h3 className="text-sm font-semibold text-gray-900">
              Live — {runningHeartbeats.length} Running
            </h3>
            <RefreshCw size={12} className="text-blue-400 animate-spin" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {runningHeartbeats.map((hb) => (
              <RunningHeartbeatCard
                key={hb.id}
                heartbeat={hb}
                onClick={() => setSelectedHeartbeatId(hb.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasData && <EmptyHeartbeatsState />}

      {/* Heartbeat detail panel */}
      {selectedHeartbeatId && (
        <HeartbeatDetail
          heartbeatId={selectedHeartbeatId}
          onClose={() => setSelectedHeartbeatId(null)}
        />
      )}

      {/* History table */}
      {!isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">History</h3>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
                  <Search size={14} className="text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="bg-transparent text-sm outline-none w-32 placeholder-gray-400"
                    data-testid="heartbeat-search"
                  />
                </div>
                {/* Status filter */}
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none"
                    data-testid="heartbeat-status-filter"
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="RUNNING">Running</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 px-4 py-2 bg-gray-50 border-b">
                Showing {filteredHeartbeats.length} of {heartbeats.length} heartbeat{heartbeats.length !== 1 ? 's' : ''}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="heartbeats-table">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Task</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Agent</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Duration</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Tokens</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Cost</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHeartbeats.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                          {heartbeats.length === 0
                            ? 'No heartbeat runs yet.'
                            : 'No heartbeats match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredHeartbeats.map((hb) => (
                        <tr
                          key={hb.id}
                          className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                            selectedHeartbeatId === hb.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedHeartbeatId(hb.id)}
                          data-testid={`heartbeat-row-${hb.id}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <StatusIcon status={hb.status} />
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${heartbeatStatusColor(
                                  hb.status,
                                )}`}
                              >
                                {hb.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 text-sm truncate max-w-xs">
                              {hb.task?.title ?? hb.taskId}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-700 text-sm">
                              {hb.agent?.name ?? hb.agentId}
                            </p>
                            {hb.agent?.role && (
                              <p className="text-xs text-gray-400">{hb.agent.role}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {formatDuration(hb.startedAt, hb.endedAt)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 text-xs">
                            {formatTokens(hb.tokensUsed)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 text-xs">
                            {formatCost(hb.cost)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHeartbeatId(hb.id);
                              }}
                              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                              title="View details"
                              data-testid={`view-heartbeat-${hb.id}`}
                            >
                              <Eye size={14} className="text-gray-500" />
                            </button>
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
