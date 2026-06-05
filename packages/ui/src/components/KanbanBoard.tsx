/**
 * KanbanBoard — Renders tasks organized in columns by status.
 *
 * Columns: Backlog → Todo → In Progress → Review → Done
 * Each column renders TaskCard components with quick status-change buttons.
 * Supports a callback for moving tasks between columns.
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React from 'react';
import { Inbox } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '@/hooks/useTasks';
import { KANBAN_COLUMNS } from '@/hooks/useTasks';

interface KanbanBoardProps {
  /** All tasks to display, grouped by status internally. */
  tasks: Task[];
  /** Called when a task's status is changed via the card controls. */
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  /** Called when a task card is clicked (opens detail view). */
  onTaskClick?: (task: Task) => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Group tasks into columns by their status.
 */
function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const grouped: Record<TaskStatus, Task[]> = {
    BACKLOG: [],
    TODO: [],
    IN_PROGRESS: [],
    REVIEW: [],
    DONE: [],
  };

  for (const task of tasks) {
    if (grouped[task.status]) {
      grouped[task.status].push(task);
    } else {
      // Fallback for unknown status
      grouped.BACKLOG.push(task);
    }
  }

  return grouped;
}

/** Skeleton loader for a kanban column */
function ColumnSkeleton() {
  return (
    <div className="flex-1 min-w-[240px] max-w-[320px]">
      <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mb-3" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  onStatusChange,
  onTaskClick,
  isLoading = false,
}: KanbanBoardProps) {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <ColumnSkeleton key={col.id} />
        ))}
      </div>
    );
  }

  const grouped = groupTasksByStatus(tasks);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
      {KANBAN_COLUMNS.map((column) => {
        const columnTasks = grouped[column.id] || [];

        return (
          <div
            key={column.id}
            className={`flex-1 min-w-[240px] max-w-[320px] rounded-xl border p-3 ${column.color}`}
            data-testid={`kanban-column-${column.id}`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">{column.label}</h3>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-medium text-gray-600 shadow-sm">
                {columnTasks.length}
              </span>
            </div>

            {/* Task cards */}
            <div className="space-y-2">
              {columnTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Inbox size={24} className="mb-2" />
                  <p className="text-xs">No tasks</p>
                </div>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onClick={onTaskClick}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
