/**
 * RoutinesPage — Full routines management page.
 *
 * Features:
 * - Routine list with status indicators
 * - Create routine form (cron, action, concurrency policy)
 * - Routine detail with run history
 * - Manual trigger button
 * - Enable/disable toggle
 * - Run history table with status badges
 *
 * Story: STORY-014 — Routines & Scheduling
 */

import React, { useState } from 'react';
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  RefreshCw,
  ChevronRight,
  X,
  Calendar,
  Settings,
  Activity,
} from 'lucide-react';
import {
  useRoutines,
  useCreateRoutine,
  useUpdateRoutine,
  useDeleteRoutine,
  useTriggerRoutine,
  ROUTINE_STATUS_COLORS,
  CONCURRENCY_POLICY_LABELS,
  CATCH_UP_POLICY_LABELS,
  type Routine,
  type RoutineRun,
  type CreateRoutineInput,
} from '@/hooks/useRoutines';
import { useAgents } from '@/hooks/useAgents';

type ViewMode = 'list' | 'detail' | 'create';

export function RoutinesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Data fetching
  const { data: routines = [], isLoading, error } = useRoutines();
  const { data: agents = [] } = useAgents();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const triggerRoutine = useTriggerRoutine();

  // Handlers
  const handleSelectRoutine = (routine: Routine) => {
    setSelectedRoutine(routine);
    setViewMode('detail');
  };

  const handleCreateRoutine = (data: CreateRoutineInput) => {
    createRoutine.mutate(data, {
      onSuccess: () => setViewMode('list'),
    });
  };

  const handleToggleEnabled = (routine: Routine) => {
    updateRoutine.mutate({
      id: routine.id,
      enabled: !routine.enabled,
    });
  };

  const handleDelete = (routineId: string) => {
    if (window.confirm('Are you sure you want to delete this routine? All run history will be lost.')) {
      deleteRoutine.mutate(routineId, {
        onSuccess: () => {
          if (selectedRoutine?.id === routineId) {
            setSelectedRoutine(null);
            setViewMode('list');
          }
        },
      });
    }
  };

  const handleTrigger = (routineId: string) => {
    triggerRoutine.mutate(routineId);
  };

  const filteredRoutines = routines.filter((r) => {
    if (statusFilter === 'enabled') return r.enabled;
    if (statusFilter === 'disabled') return !r.enabled;
    return true;
  });

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Routines</h1>
          <p className="text-gray-500">Manage scheduled jobs and recurring tasks</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Failed to load routines. Make sure the API server is running.
          </p>
          <p className="text-xs text-red-500 mt-1">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Routines</h1>
          <p className="text-gray-500">Manage scheduled jobs and recurring tasks</p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'detail' && (
            <button
              onClick={() => {
                setViewMode('list');
                setSelectedRoutine(null);
              }}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <X size={16} />
              Back
            </button>
          )}
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Create Routine
          </button>
        </div>
      </div>

      {/* Create Routine Form */}
      {viewMode === 'create' && (
        <RoutineForm
          agents={agents}
          onSubmit={handleCreateRoutine}
          onCancel={() => setViewMode('list')}
          isSubmitting={createRoutine.isPending}
        />
      )}

      {/* Routine Detail View */}
      {viewMode === 'detail' && selectedRoutine && (
        <RoutineDetailView
          routine={selectedRoutine}
          agents={agents}
          onTrigger={handleTrigger}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
          isTriggering={triggerRoutine.isPending}
        />
      )}

      {/* Routine List */}
      {viewMode === 'list' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none"
            >
              <option value="">All Routines</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
            <span className="text-sm text-gray-500">
              {filteredRoutines.length} routine{filteredRoutines.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Routines Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredRoutines.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">No routines yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create your first routine to schedule recurring tasks
                </p>
                <button
                  onClick={() => setViewMode('create')}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus size={16} />
                  Create Routine
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="routines-table">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Schedule</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Last Run</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Next Run</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRoutines.map((routine) => (
                      <tr
                        key={routine.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleSelectRoutine(routine)}
                        data-testid={`routine-row-${routine.id}`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{routine.name}</p>
                          {routine.description && (
                            <p className="text-xs text-gray-500 truncate max-w-xs">
                              {routine.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                            {routine.cron}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-gray-600">{routine.action}</code>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleEnabled(routine);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                              routine.enabled
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {routine.enabled ? (
                              <>
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                Enabled
                              </>
                            ) : (
                              <>
                                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                Disabled
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {routine.lastRunAt
                            ? new Date(routine.lastRunAt).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {routine.nextRunAt && routine.enabled
                            ? new Date(routine.nextRunAt).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrigger(routine.id);
                              }}
                              disabled={!routine.enabled || triggerRoutine.isPending}
                              className="rounded-md p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Trigger now"
                            >
                              <Play size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(routine.id);
                              }}
                              className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRoutine(routine);
                              }}
                              className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                              title="View details"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Routine Form Component ───────────────────────────────────────

interface RoutineFormProps {
  agents: Array<{ id: string; name: string; role: string }>;
  onSubmit: (data: CreateRoutineInput) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function RoutineForm({ agents, onSubmit, onCancel, isSubmitting }: RoutineFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cron, setCron] = useState('0 * * * *'); // Every hour
  const [actionType, setActionType] = useState('heartbeat');
  const [actionTarget, setActionTarget] = useState('');
  const [agentId, setAgentId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [concurrencyPolicy, setConcurrencyPolicy] = useState<string>('SKIP_IF_RUNNING');
  const [catchUpPolicy, setCatchUpPolicy] = useState<string>('SKIP');
  const [maxConcurrentRuns, setMaxConcurrentRuns] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || undefined,
      cron,
      action: `${actionType}:${actionTarget}`,
      agentId: agentId || undefined,
      enabled,
      concurrencyPolicy: concurrencyPolicy as CreateRoutineInput['concurrencyPolicy'],
      catchUpPolicy: catchUpPolicy as CreateRoutineInput['catchUpPolicy'],
      maxConcurrentRuns,
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Routine</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Daily Code Review"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Cron Expression */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cron Expression
            <span className="text-gray-400 font-normal ml-2">
              (minute hour day month weekday)
            </span>
          </label>
          <input
            type="text"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            required
            placeholder="0 * * * *"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Examples: <code>0 * * * *</code> (every hour), <code>0 9 * * 1-5</code> (weekdays at 9am), <code>*/15 * * * *</code> (every 15 min)
          </p>
        </div>

        {/* Agent */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agent (optional)</label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">No agent (system action)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.role})
              </option>
            ))}
          </select>
        </div>

        {/* Action */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="heartbeat">Heartbeat (task execution)</option>
              <option value="system">System action</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {actionType === 'heartbeat' ? 'Task ID' : 'Action Name'}
            </label>
            <input
              type="text"
              value={actionTarget}
              onChange={(e) => setActionTarget(e.target.value)}
              required
              placeholder={actionType === 'heartbeat' ? 'task-id' : 'cleanup'}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Policies */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Concurrency</label>
            <select
              value={concurrencyPolicy}
              onChange={(e) => setConcurrencyPolicy(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(CONCURRENCY_POLICY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catch-up</label>
            <select
              value={catchUpPolicy}
              onChange={(e) => setCatchUpPolicy(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(CATCH_UP_POLICY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Concurrent</label>
            <input
              type="number"
              value={maxConcurrentRuns}
              onChange={(e) => setMaxConcurrentRuns(parseInt(e.target.value, 10))}
              min={1}
              max={10}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="enabled" className="text-sm text-gray-700">
            Enable routine immediately
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Create Routine'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Routine Detail View ──────────────────────────────────────────

interface RoutineDetailViewProps {
  routine: Routine;
  agents: Array<{ id: string; name: string; role: string }>;
  onTrigger: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (routine: Routine) => void;
  isTriggering: boolean;
}

function RoutineDetailView({
  routine,
  agents,
  onTrigger,
  onDelete,
  onToggleEnabled,
  isTriggering,
}: RoutineDetailViewProps) {
  const agent = agents.find((a) => a.id === routine.agentId);

  return (
    <div className="space-y-6">
      {/* Routine Info Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{routine.name}</h2>
            {routine.description && (
              <p className="mt-1 text-sm text-gray-500">{routine.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleEnabled(routine)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                routine.enabled
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {routine.enabled ? <Pause size={14} /> : <Play size={14} />}
              {routine.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={() => onTrigger(routine.id)}
              disabled={!routine.enabled || isTriggering}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={14} />
              {isTriggering ? 'Triggering...' : 'Run Now'}
            </button>
            <button
              onClick={() => onDelete(routine.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>

        {/* Details Grid */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar size={12} /> Schedule
            </p>
            <code className="text-sm font-mono font-medium text-gray-900">{routine.cron}</code>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Activity size={12} /> Action
            </p>
            <code className="text-sm font-mono font-medium text-gray-900">{routine.action}</code>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Settings size={12} /> Concurrency
            </p>
            <p className="text-sm font-medium text-gray-900">
              {CONCURRENCY_POLICY_LABELS[routine.concurrencyPolicy] || routine.concurrencyPolicy}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <RefreshCw size={12} /> Catch-up
            </p>
            <p className="text-sm font-medium text-gray-900">
              {CATCH_UP_POLICY_LABELS[routine.catchUpPolicy] || routine.catchUpPolicy}
            </p>
          </div>
        </div>

        {/* Agent & Timing */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Agent</p>
            <p className="text-sm font-medium text-gray-900">
              {agent ? `${agent.name} (${agent.role})` : 'None (system)'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Last Run</p>
            <p className="text-sm font-medium text-gray-900">
              {routine.lastRunAt ? new Date(routine.lastRunAt).toLocaleString() : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Next Run</p>
            <p className="text-sm font-medium text-gray-900">
              {routine.nextRunAt && routine.enabled
                ? new Date(routine.nextRunAt).toLocaleString()
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Run History */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Run History</h3>
        </div>
        {routine.runs && routine.runs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Run ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Started</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ended</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Heartbeat</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {routine.runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <code className="text-xs text-gray-600">{run.id.slice(0, 12)}...</code>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ROUTINE_STATUS_COLORS[run.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {run.endedAt ? new Date(run.endedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {run.heartbeatId ? (
                        <code className="text-xs text-blue-600">{run.heartbeatId.slice(0, 12)}...</code>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {run.error ? (
                        <span className="text-xs text-red-600 truncate max-w-xs block">{run.error}</span>
                      ) : run.log ? (
                        <span className="text-xs text-gray-500 truncate max-w-xs block">{run.log}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <Clock size={32} className="mx-auto mb-2" />
            <p className="text-sm">No runs yet. Trigger the routine to see run history.</p>
          </div>
        )}
      </div>
    </div>
  );
}
