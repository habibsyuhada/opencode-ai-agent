/**
 * TaskDetail — Displays full task details in a modal/panel.
 *
 * Shows:
 * - Full description
 * - Status, priority, assignee, goal, project
 * - Artifacts list
 * - Heartbeat history
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React from 'react';
import {
  X,
  FileText,
  Activity,
  User,
  Clock,
  Zap,
  DollarSign,
  Edit,
} from 'lucide-react';
import type { Task } from '@/hooks/useTasks';
import { priorityColor, statusColor } from '@/hooks/useTasks';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onEdit?: (task: Task) => void;
}

export function TaskDetail({ task, onClose, onEdit }: TaskDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="task-detail-overlay">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl" data-testid="task-detail">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(task.status)}`}>
                {task.status.replace('_', ' ')}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${priorityColor(task.priority)}`}>
                {task.priority}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Edit task"
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

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Assignee */}
          <div className="flex items-center gap-2">
            <User size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Assignee</p>
              <p className="text-sm font-medium text-gray-900">
                {task.assignee ? task.assignee.name : 'Unassigned'}
              </p>
            </div>
          </div>

          {/* Goal / Project */}
          {task.goal && (
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Goal</p>
                <p className="text-sm font-medium text-gray-900">
                  {task.goal.name}
                  {task.goal.project && (
                    <span className="text-gray-400 ml-1">({task.goal.project.name})</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Created */}
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-sm text-gray-700">
                {new Date(task.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Updated */}
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Updated</p>
              <p className="text-sm text-gray-700">
                {new Date(task.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {task.description || 'No description provided.'}
            </p>
          </div>
        </div>

        {/* Artifacts */}
        {task.artifacts && task.artifacts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Artifacts</h3>
            <div className="space-y-1">
              {task.artifacts.map((artifact, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <FileText size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700 font-mono">{artifact}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Heartbeat History */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Heartbeat History
            {task.heartbeats && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({task.heartbeats.length} runs)
              </span>
            )}
          </h3>
          {task.heartbeats && task.heartbeats.length > 0 ? (
            <div className="space-y-2">
              {task.heartbeats.map((hb) => (
                <div
                  key={hb.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        hb.status === 'COMPLETED'
                          ? 'bg-green-500'
                          : hb.status === 'RUNNING'
                          ? 'bg-yellow-500 animate-pulse'
                          : hb.status === 'FAILED'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-700">{hb.status}</p>
                      {hb.startedAt && (
                        <p className="text-[10px] text-gray-400">
                          {new Date(hb.startedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Zap size={12} />
                      {hb.tokensUsed.toLocaleString()} tokens
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />
                      ${hb.cost.toFixed(4)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 rounded-lg border border-dashed border-gray-300">
              <Activity size={24} className="mb-2" />
              <p className="text-sm">No heartbeat runs yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
