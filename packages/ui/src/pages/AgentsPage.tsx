/**
 * AgentsPage — Full agents management page with org chart, table, and detail views.
 *
 * Features:
 * - Org chart tree visualization (using existing OrgChart component)
 * - Agent list table with filters (by role, status)
 * - Agent detail modal (edit config, view history, pause/resume/terminate)
 * - "Hire Agent" form with role template picker
 * - Connected to API via TanStack Query hooks
 *
 * Story: STORY-011 — Dashboard UI: Agents & Tasks Views
 */

import React, { useState } from 'react';
import {
  UserPlus,
  LayoutGrid,
  List,
  Users,
} from 'lucide-react';
import { OrgChart } from '@/components/OrgChart';
import { AgentTable } from '@/components/AgentTable';
import { AgentDetail } from '@/components/AgentDetail';
import { AgentForm } from '@/components/AgentForm';
import { useAgents, useCreateAgent, useUpdateAgent } from '@/hooks/useAgents';
import type { Agent, CreateAgentInput, UpdateAgentInput } from '@/hooks/useAgents';
import type { AgentNode } from '@/components/OrgChart';

type ViewMode = 'orgchart' | 'table';

export function AgentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('orgchart');
  const [showHireForm, setShowHireForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Data fetching
  const { data: agents = [], isLoading, error } = useAgents();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();

  // Convert agents to AgentNode format for OrgChart
  const agentNodes: AgentNode[] = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    title: agent.title,
    managerId: agent.managerId,
    status: agent.status,
  }));

  // Handlers
  const handleHireAgent = (data: CreateAgentInput) => {
    createAgent.mutate(data, {
      onSuccess: () => setShowHireForm(false),
    });
  };

  const handleUpdateStatus = (agentId: string, status: string) => {
    updateAgent.mutate(
      { id: agentId, status } as UpdateAgentInput & { id: string },
      {
        onSuccess: () => {
          // Refresh the selected agent data
          setSelectedAgent(null);
        },
      },
    );
  };

  const handleAgentClick = (agent: Agent) => {
    setSelectedAgent(agent);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-gray-500">Manage your AI team and org chart</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Failed to load agents. Make sure the API server is running.
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
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-gray-500">Manage your AI team and org chart</p>
        </div>
        <button
          onClick={() => setShowHireForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={16} />
          Hire Agent
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setViewMode('orgchart')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'orgchart'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutGrid size={14} />
            Org Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <List size={14} />
            Table
          </button>
        </div>

        {/* Agent count */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users size={16} />
          {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Org Chart view */}
      {viewMode === 'orgchart' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Org Chart</h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="space-y-3">
                <div className="h-16 w-48 bg-gray-200 rounded-lg animate-pulse mx-auto" />
                <div className="flex justify-center gap-4">
                  <div className="h-12 w-36 bg-gray-100 rounded-lg animate-pulse" />
                  <div className="h-12 w-36 bg-gray-100 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ) : (
            <OrgChart agents={agentNodes} />
          )}
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Agent List</h2>
          <AgentTable
            agents={agents}
            onAgentClick={handleAgentClick}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Hire Agent form modal */}
      {showHireForm && (
        <AgentForm
          agents={agents}
          onSubmit={handleHireAgent}
          onCancel={() => setShowHireForm(false)}
          isSubmitting={createAgent.isPending}
        />
      )}

      {/* Agent detail modal */}
      {selectedAgent && (
        <AgentDetail
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onEdit={(agent) => {
            setEditingAgent(agent);
            setSelectedAgent(null);
          }}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
