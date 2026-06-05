/**
 * ActivityPage — Full activity feed and audit log page.
 *
 * Features:
 * - Activity feed with real-time updates
 * - Activity statistics dashboard (total events, by action, by actor type)
 * - Filter by actor type (User, Agent, System) and action type
 * - Search by actor ID or target ID
 * - Empty state handling
 * - Connected to API via TanStack Query hooks
 *
 * Story: STORY-020 — End-to-End System Polish & QA
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Filter,
  Search,
  User,
  Bot,
  Server,
  Clock,
} from 'lucide-react';
import {
  useActivityEvents,
  useActivityStats,
  ACTION_COLORS,
  ACTOR_TYPE_COLORS,
  ACTOR_TYPE_LABELS,
  formatAction,
} from '@/hooks/useActivity';
import type { ActivityEvent } from '@/hooks/useActivity';

// ── Sub-components ──────────────────────────────────────────

/** Actor type icon */
function ActorIcon({ actorType }: { actorType: string }) {
  switch (actorType) {
    case 'USER':
      return <User size={14} className="text-blue-500" />;
    case 'AGENT':
      return <Bot size={14} className="text-purple-500" />;
    case 'SYSTEM':
      return <Server size={14} className="text-gray-500" />;
    default:
      return <Clock size={14} className="text-gray-400" />;
  }
}

/** Empty state for when no activity events exist */
function EmptyActivityState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm text-center">
      <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activity Events</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Activity events will appear here as agents perform tasks, approvals are made,
        and system actions occur. This is the audit trail for your AI team.
      </p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────

export function ActivityPage() {
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const {
    data: events = [],
    isLoading,
    error,
  } = useActivityEvents({
    actorType: actorTypeFilter || undefined,
    action: actionFilter || undefined,
    limit: 100,
  });

  const { data: stats } = useActivityStats();

  // Filter events by search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (ev) =>
        ev.actorId.toLowerCase().includes(q) ||
        ev.targetId.toLowerCase().includes(q) ||
        ev.action.toLowerCase().includes(q) ||
        ev.targetType.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  // Unique actions for filter dropdown
  const uniqueActions = useMemo(
    () => [...new Set(events.map((e) => e.action))].sort(),
    [events]
  );

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
          <p className="text-gray-500">Audit log of all system events</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Failed to load activity data. Make sure the API server is running.
          </p>
          <p className="text-xs text-red-500 mt-1">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={24} className="text-blue-600" />
          Activity
        </h1>
        <p className="text-gray-500">Audit log of all system events</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">Total Events</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          {stats.byActorType.map((item) => (
            <div
              key={item.actorType}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <ActorIcon actorType={item.actorType} />
                <p className="text-xs text-gray-500">
                  {ACTOR_TYPE_LABELS[item.actorType] || item.actorType}
                </p>
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">{item.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top Actions */}
      {stats && stats.byAction.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Actions</h3>
          <div className="flex flex-wrap gap-2">
            {stats.byAction.slice(0, 8).map((item) => (
              <span
                key={item.action}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  ACTION_COLORS[item.action] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {formatAction(item.action)} ({item.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Actor type filter */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {['', 'USER', 'AGENT', 'SYSTEM'].map((type) => (
            <button
              key={type}
              onClick={() => setActorTypeFilter(type)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                actorTypeFilter === type
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {type || 'All'}
            </button>
          ))}
        </div>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none"
        >
          <option value="">All Actions</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>
              {formatAction(action)}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor or target..."
            className="bg-transparent text-sm outline-none w-48 placeholder-gray-400"
          />
        </div>

        <span className="text-sm text-gray-500">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="p-6 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && events.length === 0 && <EmptyActivityState />}

      {/* Activity Events Table */}
      {!isLoading && events.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="text-xs text-gray-500 px-4 py-2 bg-gray-50 border-b">
            Showing {filteredEvents.length} of {events.length} events
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="activity-table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Target</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Details</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      No events match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="hover:bg-gray-50 transition-colors"
                      data-testid={`activity-row-${event.id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ActorIcon actorType={event.actorType} />
                          <div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                ACTOR_TYPE_COLORS[event.actorType] || 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {ACTOR_TYPE_LABELS[event.actorType] || event.actorType}
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5 font-mono">
                              {event.actorId.length > 16
                                ? `${event.actorId.slice(0, 12)}...`
                                : event.actorId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ACTION_COLORS[event.action] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {formatAction(event.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-700">{event.targetType}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          {event.targetId.length > 16
                            ? `${event.targetId.slice(0, 12)}...`
                            : event.targetId}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {event.metadata ? (
                          <p className="text-xs text-gray-500 truncate max-w-xs">
                            {typeof event.metadata === 'object'
                              ? JSON.stringify(event.metadata).slice(0, 80)
                              : String(event.metadata)}
                          </p>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
