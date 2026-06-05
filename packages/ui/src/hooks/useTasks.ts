/**
 * TanStack Query hooks for Task data.
 *
 * Connects to the Hono RPC API to fetch, create, update, and manage tasks.
 * Uses the Hono client from @/lib/api for type-safe API calls.
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Task status values matching the Prisma schema */
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

/** Task priority values matching the Prisma schema */
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Kanban column definitions */
export const KANBAN_COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-gray-100 border-gray-300' },
  { id: 'TODO', label: 'Todo', color: 'bg-blue-50 border-blue-300' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-50 border-yellow-300' },
  { id: 'REVIEW', label: 'Review', color: 'bg-purple-50 border-purple-300' },
  { id: 'DONE', label: 'Done', color: 'bg-green-50 border-green-300' },
];

/** Priority badge color mapping */
export function priorityColor(priority: string): string {
  switch (priority) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-300';
    case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'LOW': return 'bg-gray-100 text-gray-600 border-gray-300';
    default: return 'bg-gray-100 text-gray-600 border-gray-300';
  }
}

/** Status badge color mapping */
export function statusColor(status: string): string {
  switch (status) {
    case 'BACKLOG': return 'bg-gray-100 text-gray-600';
    case 'TODO': return 'bg-blue-100 text-blue-700';
    case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700';
    case 'REVIEW': return 'bg-purple-100 text-purple-700';
    case 'DONE': return 'bg-green-100 text-green-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

/** Task type matching the Prisma model */
export interface Task {
  id: string;
  goalId: string;
  assigneeId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  lockedAt?: string | null;
  artifacts?: string[] | null;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    id: string;
    name: string;
    role: string;
    title?: string | null;
  } | null;
  goal?: {
    id: string;
    name: string;
    project?: {
      id: string;
      name: string;
    };
  };
  heartbeats?: {
    id: string;
    status: string;
    startedAt?: string | null;
    endedAt?: string | null;
    tokensUsed: number;
    cost: number;
  }[];
  _count?: {
    heartbeats: number;
  };
}

/** Input type for creating a new task */
export interface CreateTaskInput {
  title: string;
  description?: string;
  goalId: string;
  assigneeId?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}

/** Input type for updating a task */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
}

/**
 * Fetch all tasks, optionally filtered by status or assignee.
 */
export function useTasks(filters?: { status?: string; assigneeId?: string }) {
  return useQuery<Task[]>({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (filters?.status) query.status = filters.status;
      if (filters?.assigneeId) query.assigneeId = filters.assigneeId;

      const res = await api.api.tasks.$get({ query });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const json = await res.json();
      return (json as { data: Task[] }).data;
    },
  });
}

/**
 * Fetch a single task by ID with full details (heartbeats, artifacts, etc.).
 */
export function useTask(id: string | null) {
  return useQuery<Task>({
    queryKey: ['tasks', id],
    queryFn: async () => {
      if (!id) throw new Error('Task ID is required');
      const res = await api.api.tasks[':id'].$get({ param: { id } });
      if (!res.ok) throw new Error('Failed to fetch task');
      const json = await res.json();
      return (json as { data: Task }).data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new task.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await api.api.tasks.$post({ json: input });
      if (!res.ok) throw new Error('Failed to create task');
      const json = await res.json();
      return (json as { data: Task }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Update an existing task (change status, priority, assignee, etc.).
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTaskInput & { id: string }) => {
      const res = await api.api.tasks[':id'].$patch({
        param: { id },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update task');
      const json = await res.json();
      return (json as { data: Task }).data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.id] });
    },
  });
}

/**
 * Move a task to a different status (used by Kanban board).
 */
export function useMoveTask() {
  const updateTask = useUpdateTask();

  return {
    ...updateTask,
    moveTask: (taskId: string, newStatus: TaskStatus) => {
      return updateTask.mutateAsync({ id: taskId, status: newStatus });
    },
  };
}
