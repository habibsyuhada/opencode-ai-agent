/**
 * TasksPage — Full tasks management page with Kanban board and list views.
 *
 * Features:
 * - View toggle: Kanban board ↔ List table
 * - Kanban board with 5 columns (Backlog → Done)
 * - Sortable list view
 * - Create Task form
 * - Task detail modal
 * - Connected to API via TanStack Query hooks
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React, { useState } from 'react';
import {
  Plus,
  LayoutGrid,
  List,
  ChevronUp,
  ChevronDown,
  User,
  Search,
} from 'lucide-react';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TaskCard } from '@/components/TaskCard';
import { TaskForm } from '@/components/TaskForm';
import { TaskDetail } from '@/components/TaskDetail';
import { useTasks, useCreateTask, useUpdateTask, useMoveTask } from '@/hooks/useTasks';
import { useAgents } from '@/hooks/useAgents';
import type { Task, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput } from '@/hooks/useTasks';
import { KANBAN_COLUMNS, priorityColor, statusColor } from '@/hooks/useTasks';

type ViewMode = 'kanban' | 'list';
type SortField = 'title' | 'status' | 'priority' | 'assignee' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Data fetching
  const { data: tasks = [], isLoading, error } = useTasks();
  const { data: agents = [] } = useAgents();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { moveTask } = useMoveTask();

  // Filter and sort tasks for list view
  const filteredTasks = tasks.filter((task) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !task.title.toLowerCase().includes(query) &&
        !(task.description?.toLowerCase().includes(query))
      ) {
        return false;
      }
    }
    if (statusFilter && task.status !== statusFilter) return false;
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'priority': {
        const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        cmp = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
        break;
      }
      case 'assignee':
        cmp = (a.assignee?.name || 'ZZZ').localeCompare(b.assignee?.name || 'ZZZ');
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

  // Handlers
  const handleCreateTask = (data: CreateTaskInput | UpdateTaskInput) => {
    createTask.mutate(data as CreateTaskInput, {
      onSuccess: () => setShowCreateForm(false),
    });
  };

  const handleUpdateTask = (data: CreateTaskInput | UpdateTaskInput) => {
    if (!editingTask) return;
    updateTask.mutate(
      { id: editingTask.id, ...data } as UpdateTaskInput & { id: string },
      {
        onSuccess: () => {
          setEditingTask(null);
          setSelectedTask(null);
        },
      },
    );
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    moveTask(taskId, newStatus);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500">Manage and track tasks across your AI team</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Failed to load tasks. Make sure the API server is running.
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
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500">Manage and track tasks across your AI team</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Create Task
        </button>
      </div>

      {/* View toggle + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'kanban'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <List size={14} />
            List
          </button>
        </div>

        {/* List view controls */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="bg-transparent text-sm outline-none w-40 placeholder-gray-400"
              />
            </div>
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none"
            >
              <option value="">All Statuses</option>
              {KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Kanban board view */}
      {viewMode === 'kanban' && (
        <KanbanBoard
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onTaskClick={handleTaskClick}
          isLoading={isLoading}
        />
      )}

      {/* List table view */}
      {viewMode === 'list' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 px-4 py-2 bg-gray-50 border-b">
                Showing {sortedTasks.length} of {tasks.length} tasks
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="tasks-table">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort('title')}
                      >
                        Title <SortIcon field="title" />
                      </th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort('priority')}
                      >
                        Priority <SortIcon field="priority" />
                      </th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort('assignee')}
                      >
                        Assignee <SortIcon field="assignee" />
                      </th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleSort('createdAt')}
                      >
                        Created <SortIcon field="createdAt" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                          No tasks found. Create your first task to get started.
                        </td>
                      </tr>
                    ) : (
                      sortedTasks.map((task) => (
                        <tr
                          key={task.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleTaskClick(task)}
                          data-testid={`task-row-${task.id}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-gray-500 truncate max-w-xs">
                                {task.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(
                                task.status,
                              )}`}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${priorityColor(
                                task.priority,
                              )}`}
                            >
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {task.assignee ? (
                              <div className="flex items-center gap-1.5">
                                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                                  <User size={10} className="text-white" />
                                </div>
                                <span className="text-gray-700">{task.assignee.name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {new Date(task.createdAt).toLocaleDateString()}
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

      {/* Create Task form modal */}
      {showCreateForm && (
        <TaskForm
          agents={agents}
          onSubmit={handleCreateTask}
          onCancel={() => setShowCreateForm(false)}
          isSubmitting={createTask.isPending}
        />
      )}

      {/* Task detail modal */}
      {selectedTask && !editingTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={(task) => setEditingTask(task)}
        />
      )}

      {/* Edit task form modal */}
      {editingTask && (
        <TaskForm
          task={editingTask}
          agents={agents}
          onSubmit={handleUpdateTask}
          onCancel={() => setEditingTask(null)}
          isSubmitting={updateTask.isPending}
        />
      )}
    </div>
  );
}
