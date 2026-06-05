/**
 * GovernancePage — Full governance and approval workflows page.
 *
 * Features:
 * - Pending approvals list with approve/reject actions
 * - Approval statistics dashboard
 * - Filter by status (pending, approved, rejected)
 * - Decision form with reason
 * - Approval detail view
 *
 * Story: STORY-014 — Governance: Approval Workflows
 */

import React, { useState } from 'react';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Approval type matching the Prisma model */
interface Approval {
  id: string;
  companyId: string;
  type: string;
  requestedBy: string;
  targetType: string;
  targetId: string;
  status: string;
  decision?: string | null;
  reason?: string | null;
  createdAt: string;
}

/** Approval statistics */
interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byType: Array<{ type: string; count: number }>;
}

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  DEPLOY: 'Deployment',
  BUDGET_INCREASE: 'Budget Increase',
  ROLE_CHANGE: 'Role Change',
  TASK_OVERRIDE: 'Task Override',
  CONFIG_CHANGE: 'Config Change',
  CUSTOM: 'Custom',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export function GovernancePage() {
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  const queryClient = useQueryClient();

  // Fetch approvals
  const { data: approvals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ['approvals', statusFilter],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (statusFilter) query.status = statusFilter;

      const res = await api.api.approvals.$get({ query });
      if (!res.ok) throw new Error('Failed to fetch approvals');
      const json = await res.json();
      return (json as { data: Approval[] }).data;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<ApprovalStats>({
    queryKey: ['approvals', 'stats'],
    queryFn: async () => {
      const res = await api.api.approvals.stats.$get();
      if (!res.ok) throw new Error('Failed to fetch approval stats');
      const json = await res.json();
      return (json as { data: ApprovalStats }).data;
    },
  });

  // Decide mutation
  const decideMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
    }) => {
      const res = await api.api.approvals[':id'].decide.$post({
        param: { id },
        json: { decision, reason },
      });
      if (!res.ok) throw new Error('Failed to submit decision');
      const json = await res.json();
      return (json as { data: Approval }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setSelectedApproval(null);
    },
  });

  const handleApprove = (id: string, reason?: string) => {
    decideMutation.mutate({ id, decision: 'APPROVED', reason });
  };

  const handleReject = (id: string, reason?: string) => {
    decideMutation.mutate({ id, decision: 'REJECTED', reason });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield size={24} className="text-blue-600" />
          Governance
        </h1>
        <p className="text-gray-500">Review and manage approval workflows</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-yellow-500" />
              <p className="text-xs text-gray-500">Pending</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              <p className="text-xs text-gray-500">Approved</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.approved}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-red-500" />
              <p className="text-xs text-gray-500">Rejected</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.rejected}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-blue-500" />
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {['PENDING', 'APPROVED', 'REJECTED', ''].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {/* Approval Detail Modal */}
      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setSelectedApproval(null)}
          isSubmitting={decideMutation.isPending}
        />
      )}

      {/* Approvals Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="p-12 text-center">
            <Shield size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">
              {statusFilter ? `No ${statusFilter.toLowerCase()} approvals` : 'No approvals yet'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Approval requests will appear here when agents need human authorization.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="approvals-table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Requested By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Target</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approvals.map((approval) => (
                  <tr
                    key={approval.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedApproval(approval)}
                    data-testid={`approval-row-${approval.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {APPROVAL_TYPE_LABELS[approval.type] || approval.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-gray-600">{approval.requestedBy}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {approval.targetType}:{approval.targetId.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[approval.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {approval.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 truncate max-w-xs block">
                        {approval.reason || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(approval.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {approval.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(approval.id);
                            }}
                            className="rounded-md p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(approval.id);
                            }}
                            className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Reject"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                      {approval.status !== 'PENDING' && (
                        <ChevronRight size={14} className="text-gray-400 ml-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Approval Detail Modal ────────────────────────────────────────

interface ApprovalDetailModalProps {
  approval: Approval;
  onApprove: (id: string, reason?: string) => void;
  onReject: (id: string, reason?: string) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

function ApprovalDetailModal({
  approval,
  onApprove,
  onReject,
  onClose,
  isSubmitting,
}: ApprovalDetailModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Approval Request</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">Type</p>
              <p className="text-sm font-medium text-gray-900">
                {APPROVAL_TYPE_LABELS[approval.type] || approval.type}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[approval.status] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {approval.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Requested By</p>
              <code className="text-sm text-gray-900">{approval.requestedBy}</code>
            </div>
            <div>
              <p className="text-xs text-gray-500">Target</p>
              <code className="text-sm text-gray-900">
                {approval.targetType}:{approval.targetId}
              </code>
            </div>
          </div>

          {approval.reason && (
            <div>
              <p className="text-xs text-gray-500">Reason</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{approval.reason}</p>
            </div>
          )}

          {approval.status === 'PENDING' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Decision Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain your decision..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => onReject(approval.id, reason || undefined)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={16} />
                  {isSubmitting ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={() => onApprove(approval.id, reason || undefined)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={16} />
                  {isSubmitting ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </>
          )}

          {approval.status !== 'PENDING' && approval.decision && (
            <div>
              <p className="text-xs text-gray-500">Decision</p>
              <p className="text-sm font-medium text-gray-900">{approval.decision}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
