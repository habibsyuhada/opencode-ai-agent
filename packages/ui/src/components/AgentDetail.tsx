/**
 * AgentDetail — Displays full agent details in a modal/panel.
 *
 * Shows:
 * - Agent name, role, title, status
 * - Edit config
 * - Action buttons (Pause / Resume / Terminate)
 * - Reports list
 * - Heartbeat summary
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React from 'react';
import {
  X,
  User,
  Users,
  Activity,
  Pause,
  Play,
  XCircle,
  Edit,
  Settings,
} from 'lucide-react';
import type { Agent, UpdateAgentInput } from '@/hooks/useAgents';

interface AgentDetailProps {
  agent: Agent;
  onClose: () => void;
  onEdit?: (agent: Agent) => void;
  onUpdateStatus?: (agentId: string, status: string) => void;
}

/** Status color for badges */
function agentStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'PAUSED':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'TERMINATED':
      return 'bg-red-100 text-red-700 border-red-300';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300';
  }
}

export function AgentDetail({
  agent,
  onClose,
  onEdit,
  onUpdateStatus,
}: AgentDetailProps) {
  const isActive = agent.status === 'ACTIVE';
  const isPaused = agent.status === 'PAUSED';
  const isTerminated = agent.status === 'TERMINATED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="agent-detail-overlay">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl" data-testid="agent-detail">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
              <User size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{agent.name}</h2>
              <p className="text-sm text-gray-500">{agent.title || agent.role}</p>
              <span
                className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${agentStatusColor(
                  agent.status,
                )}`}
              >
                {agent.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(agent)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Edit agent"
              >
                <Edit size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Role</p>
              <p className="text-sm font-medium text-gray-900">{agent.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Reports</p>
              <p className="text-sm font-medium text-gray-900">
                {agent.reports?.length ?? 0} direct reports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Tasks</p>
              <p className="text-sm font-medium text-gray-900">
                {agent._count?.tasks ?? 0} assigned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Heartbeats</p>
              <p className="text-sm font-medium text-gray-900">
                {agent._count?.heartbeats ?? 0} runs
              </p>
            </div>
          </div>
        </div>

        {/* Config */}
        {agent.config && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Configuration</h3>
            <pre className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 overflow-x-auto">
              {JSON.stringify(agent.config, null, 2)}
            </pre>
          </div>
        )}

        {/* Reports list */}
        {agent.reports && agent.reports.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Direct Reports</h3>
            <div className="space-y-2">
              {agent.reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <div className="h-6 w-6 rounded-full bg-blue-400 flex items-center justify-center">
                    <User size={12} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{report.name}</p>
                    <p className="text-xs text-gray-400">{report.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {onUpdateStatus && !isTerminated && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Actions</h3>
            <div className="flex items-center gap-3">
              {isActive && (
                <button
                  onClick={() => onUpdateStatus(agent.id, 'PAUSED')}
                  className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100 transition-colors"
                >
                  <Pause size={16} />
                  Pause Agent
                </button>
              )}
              {isPaused && (
                <button
                  onClick={() => onUpdateStatus(agent.id, 'ACTIVE')}
                  className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  <Play size={16} />
                  Resume Agent
                </button>
              )}
              <button
                onClick={() => onUpdateStatus(agent.id, 'TERMINATED')}
                className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                <XCircle size={16} />
                Terminate Agent
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
