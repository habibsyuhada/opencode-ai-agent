/**
 * ProjectsPage — Main project management page.
 *
 * Shows list of projects with edit/delete capabilities and a "Create Project" form.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen,
  Plus,
  Loader2,
  AlertCircle,
  FileText,
  Clock,
  Pencil,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { useActiveCompany } from '@/hooks/useCompanies';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Project {
  id: string;
  name: string;
  description: string | null;
  folderPath: string | null;
  status: string;
  phase: string;
  createdAt: string;
  orchestrator: { id: string; name: string } | null;
  documentation: { id: string; status: string } | null;
  _count: { goals: number; questions: number };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PLANNING: 'bg-blue-100 text-blue-700',
  DOCUMENTATION: 'bg-yellow-100 text-yellow-700',
  AWAITING_APPROVAL: 'bg-orange-100 text-orange-700',
  DEVELOPMENT: 'bg-green-100 text-green-700',
  TESTING: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNING: 'Planning',
  DOCUMENTATION: 'Documentation',
  AWAITING_APPROVAL: 'Awaiting Approval',
  DEVELOPMENT: 'Development',
  TESTING: 'Testing',
  COMPLETED: 'Completed',
  PAUSED: 'Paused',
};

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer stub-token',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function ProjectsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFolderPath, setFormFolderPath] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFolderPath, setEditFolderPath] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeCompany } = useActiveCompany();
  const headers = { 'X-Company-Id': activeCompany?.id || '' };

  // Fetch projects
  const { data: projects, isLoading, error } = useQuery<Project[]>({
    queryKey: ['orchestrator-projects', activeCompany?.id],
    queryFn: async () => {
      const json = await fetchJson(`${BASE_URL}/api/orchestrator/projects`, { headers });
      return json.data || [];
    },
    enabled: !!activeCompany,
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; folderPath: string }) => {
      const json = await fetchJson(`${BASE_URL}/api/orchestrator/projects`, {
        method: 'POST', headers, body: JSON.stringify(data),
      });
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrator-projects'] });
      setShowCreateForm(false);
      setFormName('');
      setFormDescription('');
      setFormFolderPath('');
    },
  });

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string; folderPath: string }) => {
      const json = await fetchJson(`${BASE_URL}/api/orchestrator/projects/${data.id}`, {
        method: 'PATCH', headers, body: JSON.stringify({
          name: data.name,
          description: data.description,
          folderPath: data.folderPath,
        }),
      });
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrator-projects'] });
      setEditingId(null);
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetchJson(`${BASE_URL}/api/orchestrator/projects/${id}`, {
        method: 'DELETE', headers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrator-projects'] });
      setDeleteConfirmId(null);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formDescription || !formFolderPath) return;
    createMutation.mutate({ name: formName, description: formDescription, folderPath: formFolderPath });
  };

  const startEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditName(project.name);
    setEditDescription(project.description || '');
    setEditFolderPath(project.folderPath || '');
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName) return;
    updateMutation.mutate({ id: editingId, name: editName, description: editDescription, folderPath: editFolderPath });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  if (!activeCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Select a company first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage your AI-powered projects</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Create Project Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Project</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., E-Commerce Platform"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe what you want to build..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Folder Path</label>
              <input type="text" value={formFolderPath} onChange={(e) => setFormFolderPath(e.target.value)}
                placeholder="e.g., C:\Projects\my-app"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            {createMutation.isError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} />
                {createMutation.error?.message || 'Failed to create project'}
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Project
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle size={18} />
          Failed to load projects
        </div>
      )}

      {/* Empty State */}
      {projects && projects.length === 0 && !showCreateForm && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FolderOpen size={48} className="mb-4 text-gray-300" />
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm">Create your first project to get started with ArmiAI</p>
        </div>
      )}

      {/* Projects List */}
      {projects && projects.length > 0 && (
        <div className="grid gap-4">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all">
              {/* Edit Mode */}
              {editingId === project.id ? (
                <form onSubmit={handleUpdate} className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                    placeholder="Project name" required />
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Description" rows={3} />
                  <input type="text" value={editFolderPath} onChange={(e) => setEditFolderPath(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Folder path" />
                  {updateMutation.isError && (
                    <p className="text-red-600 text-sm">{updateMutation.error?.message}</p>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" disabled={updateMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                      {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                /* View Mode */
                <div className="cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[project.status] || project.status}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        {project.folderPath && (
                          <span className="flex items-center gap-1">
                            <FolderOpen size={14} />
                            {project.folderPath}
                          </span>
                        )}
                        {project.documentation && (
                          <span className="flex items-center gap-1">
                            <FileText size={14} />
                            Docs: {project.documentation.status}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {project.orchestrator && (
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                          {project.orchestrator.name}
                        </span>
                      )}
                      {/* Edit Button */}
                      <button
                        onClick={(e) => startEdit(project, e)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit project"
                      >
                        <Pencil size={16} />
                      </button>
                      {/* Delete Button */}
                      {deleteConfirmId === project.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-red-600">Delete?</span>
                          <button
                            onClick={(e) => handleDelete(project.id, e)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(project.id); }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete project"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectsPage;
