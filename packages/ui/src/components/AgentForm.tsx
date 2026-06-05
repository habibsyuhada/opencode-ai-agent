/**
 * AgentForm — Modal form for hiring a new agent.
 *
 * Features:
 * - Role template picker with descriptions
 * - Name and title fields
 * - Manager selection for org chart placement
 * - Config override (optional JSON)
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React, { useState } from 'react';
import { X, UserPlus, Check } from 'lucide-react';
import type { CreateAgentInput, RoleTemplate } from '@/hooks/useAgents';
import { ROLE_TEMPLATES } from '@/hooks/useAgents';
import type { Agent } from '@/hooks/useAgents';

interface AgentFormProps {
  /** Existing agents for manager selection. */
  agents?: Agent[];
  /** Called on form submit. */
  onSubmit: (data: CreateAgentInput) => void;
  /** Called when form is cancelled. */
  onCancel: () => void;
  /** Loading state while submitting. */
  isSubmitting?: boolean;
}

export function AgentForm({
  agents = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: AgentFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [managerId, setManagerId] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [configError, setConfigError] = useState('');

  const handleTemplateSelect = (template: RoleTemplate) => {
    setSelectedTemplate(template);
    setTitle(template.title);
    setConfigJson(JSON.stringify(template.defaultConfig, null, 2));
    setConfigError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !name.trim()) return;

    // Validate config JSON if provided
    let config: Record<string, unknown> | undefined;
    if (configJson.trim()) {
      try {
        config = JSON.parse(configJson);
        setConfigError('');
      } catch {
        setConfigError('Invalid JSON configuration');
        return;
      }
    }

    onSubmit({
      name: name.trim(),
      role: selectedTemplate.role,
      title: title.trim() || undefined,
      managerId: managerId || undefined,
      config,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="agent-form-overlay">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl" data-testid="agent-form">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Hire Agent</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Role Template Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Role Template <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_TEMPLATES.map((template) => {
                const isSelected = selectedTemplate?.role === template.role;
                return (
                  <button
                    key={template.role}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className={`relative rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check size={14} className="text-blue-600" />
                      </div>
                    )}
                    <p className="text-sm font-medium text-gray-900">{template.title}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {template.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Agent details (shown after template selection) */}
          {selectedTemplate && (
            <>
              {/* Name */}
              <div>
                <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder={`e.g., ${selectedTemplate.role.charAt(0).toUpperCase() + selectedTemplate.role.slice(1)} Bot`}
                  required
                  autoFocus
                />
              </div>

              {/* Title */}
              <div>
                <label htmlFor="agent-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  id="agent-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Senior Developer"
                />
              </div>

              {/* Manager */}
              {agents.length > 0 && (
                <div>
                  <label htmlFor="agent-manager" className="block text-sm font-medium text-gray-700 mb-1">
                    Reports To (Manager)
                  </label>
                  <select
                    id="agent-manager"
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="">No manager (root level)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Config override */}
              <div>
                <label htmlFor="agent-config" className="block text-sm font-medium text-gray-700 mb-1">
                  Configuration (JSON, optional)
                </label>
                <textarea
                  id="agent-config"
                  value={configJson}
                  onChange={(e) => {
                    setConfigJson(e.target.value);
                    setConfigError('');
                  }}
                  rows={4}
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none ${
                    configError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder='{"model": "claude-sonnet-4-20250514"}'
                />
                {configError && (
                  <p className="mt-1 text-xs text-red-600">{configError}</p>
                )}
              </div>
            </>
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
              disabled={isSubmitting || !selectedTemplate || !name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Hiring...' : 'Hire Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
