/**
 * SettingsPage — Workspace settings with secret management.
 *
 * Features:
 * - View list of existing secrets (with masked values)
 * - Add new secrets via a form (name in UPPER_SNAKE_CASE, value, scope)
 * - Delete existing secrets
 * - Scope filter (GLOBAL, AGENT, or All)
 *
 * SECURITY: The UI NEVER receives decrypted secret values.
 * Only masked representations are shown in the table.
 *
 * Architecture reference: docs/architecture/architecture.md §8
 * PRD reference: docs/prd/prd.md §11 (NFR-004)
 * Story: STORY-017 — Dashboard UI: Secret Management
 */

import React, { useState } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
  X,
  Search,
} from 'lucide-react';
import { useSecrets, useCreateSecret, useDeleteSecret } from '@/hooks/useSecrets';
import type { SecretScope, CreateSecretInput } from '@/hooks/useSecrets';

// ── Constants ────────────────────────────────────────────────

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  AGENT: 'Agent',
};

const SCOPE_COLORS: Record<string, string> = {
  GLOBAL: 'bg-blue-100 text-blue-700 border-blue-200',
  AGENT: 'bg-purple-100 text-purple-700 border-purple-200',
};

// ── Main Page Component ──────────────────────────────────────

export function SettingsPage() {
  const [scopeFilter, setScopeFilter] = useState<SecretScope | ''>('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Queries & mutations
  const { data: secrets = [], isLoading } = useSecrets(
    scopeFilter ? { scope: scopeFilter as SecretScope } : undefined,
  );
  const createMutation = useCreateSecret();
  const deleteMutation = useDeleteSecret();

  // Form state
  const [formName, setFormName] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formScope, setFormScope] = useState<SecretScope>('GLOBAL');
  const [showValue, setShowValue] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validation: UPPER_SNAKE_CASE
    const nameRegex = /^[A-Z][A-Z0-9_]*$/;
    if (!nameRegex.test(formName)) {
      setFormError('Name must be UPPER_SNAKE_CASE (e.g., OPENAI_API_KEY)');
      return;
    }

    if (!formValue.trim()) {
      setFormError('Secret value is required');
      return;
    }

    const input: CreateSecretInput = {
      name: formName.trim(),
      value: formValue,
      scope: formScope,
    };

    createMutation.mutate(input, {
      onSuccess: () => {
        // Reset form on success
        setFormName('');
        setFormValue('');
        setFormScope('GLOBAL');
        setShowValue(false);
        setShowAddForm(false);
        setFormError(null);
      },
      onError: (err: Error) => {
        setFormError(err.message || 'Failed to create secret');
      },
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Key size={24} className="text-blue-600" />
          Settings
        </h1>
        <p className="text-gray-500">Manage secrets and workspace configuration</p>
      </div>

      {/* ── Secrets Section ──────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Section header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Secrets</h2>
            {!isLoading && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {secrets.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            data-testid="add-secret-button"
          >
            <Plus size={16} />
            Add Secret
          </button>
        </div>

        {/* Add Secret Form */}
        {showAddForm && (
          <div className="border-b border-gray-200 bg-gray-50 p-6" data-testid="secret-form">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">New Secret</h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Name input */}
                <div>
                  <label
                    htmlFor="secret-name"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="secret-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value.toUpperCase())}
                    placeholder="OPENAI_API_KEY"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                    data-testid="secret-name-input"
                  />
                  <p className="mt-1 text-xs text-gray-400">Must be UPPER_SNAKE_CASE</p>
                </div>

                {/* Value input */}
                <div>
                  <label
                    htmlFor="secret-value"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Value
                  </label>
                  <div className="relative">
                    <input
                      id="secret-value"
                      type={showValue ? 'text' : 'password'}
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      placeholder="Enter secret value..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      data-testid="secret-value-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowValue(!showValue)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title={showValue ? 'Hide value' : 'Show value'}
                    >
                      {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Scope select */}
                <div>
                  <label
                    htmlFor="secret-scope"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Scope
                  </label>
                  <select
                    id="secret-scope"
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as SecretScope)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    data-testid="secret-scope-select"
                  >
                    <option value="GLOBAL">Global</option>
                    <option value="AGENT">Agent</option>
                  </select>
                </div>
              </div>

              {/* Error message */}
              {formError && (
                <div
                  className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
                  data-testid="secret-form-error"
                >
                  <AlertCircle size={14} />
                  {formError}
                </div>
              )}

              {/* Form actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError(null);
                    setFormName('');
                    setFormValue('');
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  data-testid="secret-submit-button"
                >
                  <Plus size={14} />
                  {createMutation.isPending ? 'Saving...' : 'Save Secret'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Scope filter */}
        <div className="flex items-center gap-1 border-b border-gray-100 px-6 py-3">
          {(['', 'GLOBAL', 'AGENT'] as const).map((scope) => (
            <button
              key={scope}
              onClick={() => setScopeFilter(scope)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                scopeFilter === scope
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {scope ? SCOPE_LABELS[scope] : 'All'}
            </button>
          ))}
        </div>

        {/* Secrets table */}
        {isLoading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : secrets.length === 0 ? (
          <div className="p-12 text-center">
            <Key size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No secrets configured</p>
            <p className="text-sm text-gray-400 mt-1">
              Add API keys and tokens that your AI agents need to perform tasks.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="secrets-table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Value</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Scope</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {secrets.map((secret) => (
                  <tr
                    key={secret.id}
                    className="hover:bg-gray-50 transition-colors"
                    data-testid={`secret-row-${secret.id}`}
                  >
                    <td className="px-6 py-3">
                      <code className="text-sm font-medium text-gray-900 font-mono">
                        {secret.name}
                      </code>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-sm text-gray-500 font-mono">
                        {secret.maskedValue}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          SCOPE_COLORS[secret.scope] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {SCOPE_LABELS[secret.scope] || secret.scope}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() =>
                          setDeleteTarget({ id: secret.id, name: secret.name })
                        }
                        className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title={`Delete ${secret.name}`}
                        data-testid={`delete-secret-${secret.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          secretName={deleteTarget.name}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────

interface DeleteConfirmModalProps {
  secretName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({
  secretName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Delete Secret</h3>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <code className="font-mono font-medium text-gray-900">{secretName}</code>?
            This action cannot be undone. Any agents using this secret will lose access.
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              data-testid="confirm-delete-button"
            >
              <Trash2 size={14} />
              {isDeleting ? 'Deleting...' : 'Delete Secret'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
