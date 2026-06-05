/**
 * TaskForm — Modal form for creating or editing a task.
 *
 * Supports:
 * - Title, description, priority, status fields
 * - Goal selection (required for creation)
 * - Agent assignment
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { CreateTaskInput, UpdateTaskInput, Task, TaskStatus, TaskPriority } from '@/hooks/useTasks';
import { KANBAN_COLUMNS } from '@/hooks/useTasks';
import type { Agent } from '@/hooks/useAgents';

interface TaskFormProps {
  /** Existing task for edit mode; omit for create mode. */
  task?: Task;
  /** Available agents for assignment dropdown. */
  agents?: Agent[];
  /** Goals for the goal dropdown (create mode). */
  goals?: { id: string; name: string }[];
  /** Called on form submit. */
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => void;
  /** Called when form is cancelled. */
  onCancel: () => void;
  /** Loading state while submitting. */
  isSubmitting?: boolean;
}

const PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_OPTIONS: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export function TaskForm({
  task,
  agents = [],
  goals = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: TaskFormProps) {
  const isEditMode = !!task;

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'MEDIUM');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'TODO');
  const [goalId, setGoalId] = useState(task?.goalId || goals[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEditMode) {
      onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        assigneeId: assigneeId || null,
      } as UpdateTaskInput);
    } else {
      onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        goalId,
        assigneeId: assigneeId || undefined,
      } as CreateTaskInput);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="task-form-overlay">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" data-testid="task-form">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditMode ? 'Edit Task' : 'Create Task'}
          </h2>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Enter task title..."
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              placeholder="Describe the task..."
            />
          </div>

          {/* Goal (create mode only) */}
          {!isEditMode && goals.length > 0 && (
            <div>
              <label htmlFor="task-goal" className="block text-sm font-medium text-gray-700 mb-1">
                Goal <span className="text-red-500">*</span>
              </label>
              <select
                id="task-goal"
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              >
                <option value="">Select a goal...</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Priority + Status row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            {isEditMode && (
              <div>
                <label htmlFor="task-status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="task-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {KANBAN_COLUMNS.find((c) => c.id === s)?.label || s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Assignee */}
          {agents.length > 0 && (
            <div>
              <label htmlFor="task-assignee" className="block text-sm font-medium text-gray-700 mb-1">
                Assignee
              </label>
              <select
                id="task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
