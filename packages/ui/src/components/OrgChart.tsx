import React from 'react';
import { User, ChevronDown } from 'lucide-react';

/**
 * Agent interface matching the Prisma Agent model's relevant fields
 * for org chart rendering.
 */
export interface AgentNode {
  id: string;
  name: string;
  role: string;
  title?: string | null;
  managerId?: string | null;
  status: string;
  children?: AgentNode[];
}

interface OrgChartProps {
  /** Agents data; if not provided, shows an empty state. */
  agents?: AgentNode[];
}

/**
 * Build a tree structure from a flat list of agents using `managerId`.
 * Agents without a managerId (orphaned) are placed at the root level.
 */
export function buildAgentTree(agents: AgentNode[]): AgentNode[] {
  const map = new Map<string, AgentNode>();
  const roots: AgentNode[] = [];

  // First pass: index all agents
  for (const agent of agents) {
    map.set(agent.id, { ...agent, children: [] });
  }

  // Second pass: assign children to parents
  for (const agent of agents) {
    const node = map.get(agent.id)!;
    if (agent.managerId && map.has(agent.managerId)) {
      const parent = map.get(agent.managerId)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      // No manager or manager not found — root level
      roots.push(node);
    }
  }

  return roots;
}

/** Status color mapping */
function statusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'IDLE':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'OFFLINE':
      return 'bg-gray-100 text-gray-500 border-gray-300';
    default:
      return 'bg-blue-100 text-blue-700 border-blue-300';
  }
}

/** Recursive tree node component */
function TreeNode({ agent, depth = 0 }: { agent: AgentNode; depth?: number }) {
  const hasChildren = agent.children && agent.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Agent card */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-sm ${statusColor(
          agent.status,
        )}`}
      >
        <User size={16} />
        <div>
          <p className="text-sm font-semibold">{agent.name}</p>
          <p className="text-xs opacity-75">{agent.title || agent.role}</p>
        </div>
      </div>

      {/* Children connector */}
      {hasChildren && (
        <>
          <div className="h-4 w-px bg-gray-300" />
          <ChevronDown size={14} className="text-gray-400 -mt-1" />
          <div className="flex gap-4 pt-2">
            {agent.children!.map((child) => (
              <TreeNode key={child.id} agent={child} depth={depth + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * OrgChart — Renders a hierarchical tree of agents based on managerId.
 *
 * - Uses `buildAgentTree` to convert a flat agent list into a tree.
 * - Renders recursive `TreeNode` components.
 * - Shows an empty state when no agents are provided.
 */
export function OrgChart({ agents = [] }: OrgChartProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <User size={48} className="mb-4" />
        <p className="text-sm">No agents found. Agents will appear here once added.</p>
      </div>
    );
  }

  const tree = buildAgentTree(agents);

  return (
    <div className="flex justify-center overflow-x-auto py-4">
      <div className="flex gap-8">
        {tree.map((root) => (
          <TreeNode key={root.id} agent={root} />
        ))}
      </div>
    </div>
  );
}
