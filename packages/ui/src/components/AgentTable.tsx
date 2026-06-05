/**
 * AgentTable — Renders a filterable, sortable table of agents.
 *
 * Supports:
 * - Filtering by role and status
 * - Click to open agent detail
 * - Visual status badges
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React, { useState } from 'react';
import { User, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import type { Agent } from '@/hooks/useAgents';

interface AgentTableProps {
  agents: Agent[];
  onAgentClick?: (agent: Agent) => void;
  isLoading?: boolean;
}

type SortField = 'name' | 'role' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

/** Status badge styles */
function agentStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'PAUSED':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'TERMINATED':
      return 'bg-red-100 text-red-700 border-red-300';
    case 'IDLE':
      return 'bg-gray-100 text-gray-600 border-gray-300';
    default:
      return 'bg-blue-100 text-blue-700 border-blue-300';
  }
}

/** Unique roles from agent list */
function getUniqueRoles(agents: Agent[]): string[] {
  return [...new Set(agents.map((a) => a.role))].sort();
}

/** Unique statuses from agent list */
function getUniqueStatuses(agents: Agent[]): string[] {
  return [...new Set(agents.map((a) => a.status))].sort();
}

/** Table skeleton loader */
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export function AgentTable({ agents, onAgentClick, isLoading = false }: AgentTableProps) {
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);

  const uniqueRoles = getUniqueRoles(agents);
  const uniqueStatuses = getUniqueStatuses(agents);

  // Apply filters
  const filtered = agents.filter((agent) => {
    if (roleFilter && agent.role !== roleFilter) return false;
    if (statusFilter && agent.status !== statusFilter) return false;
    return true;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'role':
        cmp = a.role.localeCompare(b.role);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'createdAt':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1" />
    ) : (
      <ChevronDown size={14} className="inline ml-1" />
    );
  };

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div data-testid="agent-table">
      {/* Filter controls */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Filter size={16} />
          Filters
          {(roleFilter || statusFilter) && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              Active
            </span>
          )}
        </button>

        {showFilters && (
          <div className="mt-2 flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div>
              <label htmlFor="role-filter" className="block text-xs font-medium text-gray-500 mb-1">
                Role
              </label>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="">All Roles</option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status-filter" className="block text-xs font-medium text-gray-500 mb-1">
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            {(roleFilter || statusFilter) && (
              <button
                onClick={() => {
                  setRoleFilter('');
                  setStatusFilter('');
                }}
                className="mt-4 text-xs text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="mb-2 text-xs text-gray-500">
        Showing {sorted.length} of {agents.length} agents
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('name')}
              >
                Name <SortIcon field="name" />
              </th>
              <th
                className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('role')}
              >
                Role <SortIcon field="role" />
              </th>
              <th
                className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('status')}
              >
                Status <SortIcon field="status" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tasks</th>
              <th
                className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('createdAt')}
              >
                Created <SortIcon field="createdAt" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No agents found matching the current filters.
                </td>
              </tr>
            ) : (
              sorted.map((agent) => (
                <tr
                  key={agent.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onAgentClick?.(agent)}
                  data-testid={`agent-row-${agent.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center">
                        <User size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        {agent.title && (
                          <p className="text-xs text-gray-500">{agent.title}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{agent.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${agentStatusColor(
                        agent.status,
                      )}`}
                    >
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {agent._count?.tasks ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
