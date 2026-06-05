/**
 * ProjectDetailPage — Shows project details, documentation, and agent questions.
 *
 * This is where the user:
 * - Reviews generated documentation (PRD, Architecture, Stories)
 * - Approves or rejects documentation
 * - Answers agent questions
 * - Monitors project progress
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  Play,
  FolderOpen,
  Send,
} from 'lucide-react';
import { useActiveCompany } from '@/hooks/useCompanies';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer stub-token',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeCompany } = useActiveCompany();
  const [answerText, setAnswerText] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const headers = { 'X-Company-Id': activeCompany?.id || '' };

  // Fetch project details
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['orchestrator-project', id],
    queryFn: async () => {
      const json = await fetchJson(`${BASE_URL}/api/orchestrator/projects/${id}`, { headers });
      return json.data;
    },
    enabled: !!id && !!activeCompany,
  });

  // Start documentation mutation
  const startDocMutation = useMutation({
    mutationFn: async () => {
      const json = await fetchJson(
        `${BASE_URL}/api/orchestrator/projects/${id}/start-documentation`,
        { method: 'POST', headers }
      );
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrator-project', id] });
    },
  });

  // Approve documentation mutation
  const approveMutation = useMutation({
    mutationFn: async (data: { approved: boolean; rejectionReason?: string }) => {
      const json = await fetchJson(
        `${BASE_URL}/api/orchestrator/projects/${id}/approve-documentation`,
        { method: 'POST', headers, body: JSON.stringify(data) }
      );
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrator-project', id] });
      setShowRejectForm(false);
      setRejectReason('');
    },
  });

  // Answer question mutation
  const answerMutation = useMutation({
    mutationFn: async (data: { questionId: string; answer: string }) => {
      const json = await fetchJson(
        `${BASE_URL}/api/orchestrator/questions/${data.questionId}/answer`,
        { method: 'POST', headers, body: JSON.stringify({ answer: data.answer }) }
      );
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestrator-project', id] });
      setAnswerText({});
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertCircle size={48} className="mb-4 text-red-300" />
        <p>Project not found</p>
        <button onClick={() => navigate('/projects')} className="text-blue-600 mt-2">
          Back to Projects
        </button>
      </div>
    );
  }

  const pendingQuestions = (project.questions || []).filter((q: any) => q.status === 'PENDING');
  const doc = project.documentation;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {project.status}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* Project Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Folder</p>
          <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
            <FolderOpen size={16} className="text-gray-400" />
            {project.folderPath || 'Not set'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Phase</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{project.phase}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Orchestrator</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {project.orchestrator?.name || 'Not assigned'}
          </p>
        </div>
      </div>

      {/* Pending Questions */}
      {pendingQuestions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={20} className="text-yellow-600" />
            <h2 className="text-lg font-semibold text-yellow-900">
              Agent Questions ({pendingQuestions.length})
            </h2>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            Your agents need clarification before they can continue. Please answer their questions.
          </p>
          <div className="space-y-3">
            {pendingQuestions.map((q: any) => (
              <div key={q.id} className="bg-white rounded-lg border border-yellow-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-900">{q.agent?.name}</span>
                  <span className="text-xs text-gray-500">asks:</span>
                  {q.priority === 'BLOCKING' && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                      BLOCKING
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 mb-3">{q.question}</p>
                {q.context && (
                  <p className="text-xs text-gray-500 mb-3 italic">Context: {q.context}</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={answerText[q.id] || ''}
                    onChange={(e) => setAnswerText({ ...answerText, [q.id]: e.target.value })}
                    placeholder="Type your answer..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && answerText[q.id]?.trim()) {
                        answerMutation.mutate({
                          questionId: q.id,
                          answer: answerText[q.id].trim(),
                        });
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (answerText[q.id]?.trim()) {
                        answerMutation.mutate({
                          questionId: q.id,
                          answer: answerText[q.id].trim(),
                        });
                      }
                    }}
                    disabled={!answerText[q.id]?.trim() || answerMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm
                               hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documentation Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Documentation</h2>
          </div>
          {project.status === 'PLANNING' && (
            <button
              onClick={() => startDocMutation.mutate()}
              disabled={startDocMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {startDocMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              Start Documentation
            </button>
          )}
        </div>

        {!doc && (
          <div className="text-center py-8 text-gray-500">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <p>Documentation will be generated when you start the documentation phase.</p>
          </div>
        )}

        {doc && (
          <div className="space-y-4">
            <DocSection title="Product Requirements Document (PRD)" content={doc.prd} />
            <DocSection title="Architecture Document" content={doc.architecture} />
            <DocSection title="Technology Stack" content={doc.techStack} />
            <DocSection title="Development Stories" content={doc.stories} />

            {doc.status === 'READY' && (
              <div className="border-t border-gray-200 pt-4 mt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Review the documentation above. Approve to proceed to development, or reject to request changes.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => approveMutation.mutate({ approved: true })}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg
                               hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    <CheckCircle size={16} />
                    Approve Documentation
                  </button>
                  <button
                    onClick={() => setShowRejectForm(!showRejectForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg
                               hover:bg-red-700 transition-colors font-medium"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
                {showRejectForm && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <label className="block text-sm font-medium text-red-700 mb-2">
                      Reason for rejection:
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain what needs to be changed..."
                      rows={3}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm
                                 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <button
                      onClick={() =>
                        approveMutation.mutate({
                          approved: false,
                          rejectionReason: rejectReason,
                        })
                      }
                      disabled={approveMutation.isPending}
                      className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm
                                 hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      Submit Rejection
                    </button>
                  </div>
                )}
              </div>
            )}

            {doc.status === 'APPROVED' && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle size={18} className="text-green-600" />
                <span className="text-sm text-green-700 font-medium">
                  Documentation approved — Development phase can begin
                </span>
              </div>
            )}

            {doc.status === 'REJECTED' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <XCircle size={18} className="text-red-600" />
                <span className="text-sm text-red-700">
                  Documentation rejected: {doc.rejectionReason || 'No reason provided'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tasks / Goals */}
      {project.goals && project.goals.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Goals & Tasks</h2>
          <div className="space-y-4">
            {project.goals.map((goal: any) => (
              <div key={goal.id} className="border border-gray-100 rounded-lg p-4">
                <h3 className="font-medium text-gray-900">{goal.name}</h3>
                <span className="text-xs text-gray-500">{goal.status}</span>
                {goal.tasks && goal.tasks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {goal.tasks.map((task: any) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 text-sm p-2 bg-gray-50 rounded"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            task.status === 'DONE'
                              ? 'bg-green-500'
                              : task.status === 'IN_PROGRESS'
                              ? 'bg-blue-500'
                              : 'bg-gray-300'
                          }`}
                        />
                        <span className="flex-1">{task.title}</span>
                        <span className="text-xs text-gray-500">{task.status}</span>
                        {task.assignee && (
                          <span className="text-xs text-gray-400">{task.assignee.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocSection({ title, content }: { title: string; content: string | null }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-900 text-sm">{title}</span>
        <span className="text-xs text-gray-500">
          {content ? (expanded ? '▲ Collapse' : '▼ Expand') : '⏳ Pending'}
        </span>
      </button>
      {expanded && content && (
        <div className="p-4 border-t border-gray-100">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{content}</pre>
        </div>
      )}
    </div>
  );
}

export default ProjectDetailPage;
