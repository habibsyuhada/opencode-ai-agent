// Core Types and Interfaces for ArmiAI Platform

// Company
export interface Company {
  id: string;
  name: string;
  slug: string;
  mission?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workspace
export interface Workspace {
  id: string;
  companyId: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

// Agent Role
export enum AgentRole {
  CEO = 'CEO',
  CTO = 'CTO',
  DEVELOPER = 'DEVELOPER',
  QA = 'QA',
  SCRUM_MASTER = 'SCRUM_MASTER',
  PRODUCT_MANAGER = 'PRODUCT_MANAGER',
  DESIGNER = 'DESIGNER',
}

export enum AgentStatus {
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

export interface AgentConfig {
  instructions: string;
  tools?: string[];
  [key: string]: any;
}

// Agent
export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: AgentRole;
  title: string;
  managerId?: string; // ID of the parent Agent
  status: AgentStatus;
  config: AgentConfig;
  createdAt: Date;
  updatedAt: Date;
}

// Project
export interface Project {
  id: string;
  companyId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Goal
export enum GoalStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Goal {
  id: string;
  projectId: string;
  name: string;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Task
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface Task {
  id: string;
  goalId: string;
  assigneeId?: string; // ID of the Agent assigned to the task
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  lockedAt?: Date; // For atomic checkout
  artifacts?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Heartbeat
export enum HeartbeatStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Heartbeat {
  id: string;
  taskId: string;
  agentId: string;
  status: HeartbeatStatus;
  startedAt: Date;
  endedAt?: Date;
  log?: string;
  tokensUsed?: number;
  cost?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Budget
export interface Budget {
  id: string;
  companyId: string;
  agentId?: string; // If null, applies to the whole company
  monthly: number;
  used: number;
  currency: string;
  threshold?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Cost Event
export interface CostEvent {
  id: string;
  heartbeatId: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  createdAt: Date;
}

// Approval
export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ApprovalType {
  DEPLOYMENT = 'DEPLOYMENT',
  BUDGET_EXPANSION = 'BUDGET_EXPANSION',
  TASK_COMPLETION = 'TASK_COMPLETION',
}

export interface Approval {
  id: string;
  companyId: string;
  type: ApprovalType;
  requestedBy: string; // User ID or Agent ID
  targetType: string;
  targetId: string;
  status: ApprovalStatus;
  decision?: string;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Activity Event
export interface ActivityEvent {
  id: string;
  companyId: string;
  actorType: 'USER' | 'AGENT' | 'SYSTEM';
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: any;
  createdAt: Date;
}

// Routine
export interface Routine {
  id: string;
  companyId: string;
  agentId: string;
  name: string;
  cron: string;
  action: string; // The action or script to run
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Secret
export interface Secret {
  id: string;
  companyId: string;
  name: string;
  encryptedValue: string;
  scope?: string;
  createdAt: Date;
  updatedAt: Date;
}
