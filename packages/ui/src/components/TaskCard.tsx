/**
 * TaskCard — Renders a single task as a card for the Kanban board.
 *
 * Displays title, priority badge, assignee avatar, and status controls.
 * Used within KanbanBoard columns.
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React from 'react';
import { User, ArrowRight, GripVertical } from 'lucide-react';
import type { Task, TaskStatus } from '@/hooks/useTasks';
import { priorityColor, KANBAN_COLUMNS } from '@/hooks/useTasks';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onClick?: (task: Task) => void;
}

/**
 * Status transition map — defines which statuses a task can move to from each status.
 * This prevents invalid transitions (e.g., BACKLOG → DONE).
 */
const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ['TODO'],
  TODO: ['BACKLOG', 'IN_PROGRESS'],
  IN_PROGRESS: ['TODO', 'REVIEW'],
  REVIEW: ['IN_PROGRESS', 'DONE'],
  DONE: ['REVIEW'],
};

export function TaskCard({ task, onStatusChange, onClick }: TaskCardProps) {
  const transitions = STATUS_TRANSITIONS[task.status] || [];

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onClick?.(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(task);
        }
      }}
    >
      {/* Drag handle hint */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical
            size={14}
            className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          />
          <h4 className="text-sm font-medium text-gray-900 truncate">{task.title}</h4>
        </div>
        <span
          className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${priorityColor(
            task.priority,
          )}`}
        >
          {task.priority}
        </span>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="mt-1.5 text-xs text-gray-500 line-clamp-2 pl-5">
          {task.description}
        </p>
      )}

      {/* Footer: assignee + status controls */}
      <div className="mt-3 flex items-center justify-between pl-5">
        {/* Assignee */}
        <div className="flex items-center gap-1.5">
          {task.assignee ? (
            <>
              <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                <User size={10} className="text-white" />
              </div>
              <span className="text-xs text-gray-600 truncate max-w-[100px]">
                {task.assignee.name}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400 italic">Unassigned</span>
          )}
        </div>

        {/* Quick status move buttons */}
        {transitions.length > 0 && onStatusChange && (
          <div className="flex items-center gap-1">
            {transitions.map((nextStatus) => {
              const col = KANBAN_COLUMNS.find((c) => c.id === nextStatus);
              return (
                <button
                  key={nextStatus}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(task.id, nextStatus);
                  }}
                  className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  title={`Move to ${col?.label || nextStatus}`}
                >
                  <ArrowRight size={10} />
                  {col?.label || nextStatus}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Heartbeat count indicator */}
      {task._count?.heartbeats ? (
        <div className="mt-2 pl-5">
          <span className="text-[10px] text-gray-400">
            {task._count.heartbeats} heartbeat{task._count.heartbeats !== 1 ? 's' : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}
