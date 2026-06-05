/**
 * Orchestrator Service — Manages the entire project lifecycle.
 *
 * The orchestrator is the central coordinator that:
 * 1. Receives project descriptions from users
 * 2. Delegates to specialized agents in the correct order
 * 3. Manages phase transitions (Documentation → Approval → Development)
 * 4. Relays agent questions to the user
 * 5. Waits for user approval between phases
 *
 * Flow:
 *   INITIALIZATION → DOCUMENTATION (PRD → Architecture → Stories)
 *   → AWAITING_APPROVAL → DEVELOPMENT → TESTING → COMPLETED
 */

import prisma from '../../db/client.js';
import { getAgentTemplate, AGENT_TEMPLATES } from '../../agents/templates.js';
import { logger } from '../../utils/logger.js';
import { recordActivity, ActivityActions } from '../../utils/activity.js';
import { triggerHeartbeat } from '../heartbeat/service.js';

// ── Types ─────────────────────────────────────────────────────

export type ProjectPhase =
  | 'INITIALIZATION'
  | 'DOCUMENTATION'
  | 'APPROVAL'
  | 'DEVELOPMENT'
  | 'TESTING'
  | 'DEPLOYMENT';

export type ProjectStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'DOCUMENTATION'
  | 'AWAITING_APPROVAL'
  | 'DEVELOPMENT'
  | 'TESTING'
  | 'COMPLETED'
  | 'PAUSED';

export type DocumentationStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'READY'
  | 'APPROVED'
  | 'REJECTED';

interface CreateProjectInput {
  name: string;
  description: string;
  folderPath: string;
}

// ── Project Creation ──────────────────────────────────────────

/**
 * Create a new project with all required agents.
 *
 * This is the entry point for the user workflow:
 * 1. Create the project record
 * 2. Auto-create all agent templates for the company
 * 3. Link the orchestrator to the project
 * 4. Start the documentation phase
 */
export async function createProjectWithAgents(
  data: CreateProjectInput,
  companyId: string
) {
  // 1. Create the project
  const project = await prisma.project.create({
    data: {
      companyId,
      name: data.name,
      description: data.description,
      folderPath: data.folderPath,
      status: 'PLANNING',
      phase: 'INITIALIZATION',
    },
  });

  logger.info('Project created', {
    projectId: project.id,
    name: project.name,
    folderPath: project.folderPath,
  });

  // 2. Create agent instances from templates (if not already existing)
  let agents: any[] = [];
  try {
    agents = await ensureAgentsExist(companyId);
  } catch (err) {
    logger.error('Failed to ensure agents exist', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Continue without agents — project is still created
  }

  // 3. Link orchestrator to project
  const orchestrator = agents.find(a => a.templateKey === 'orchestrator');
  if (orchestrator) {
    try {
      await prisma.project.update({
        where: { id: project.id },
        data: { orchestratorId: orchestrator.id },
      });
    } catch (err) {
      logger.error('Failed to link orchestrator', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 4. Create initial documentation record
  try {
    await prisma.projectDocumentation.create({
      data: {
        projectId: project.id,
        status: 'DRAFT',
      },
    });
  } catch (err) {
    logger.error('Failed to create documentation record', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Record activity
  try {
    await recordActivity({
      companyId,
      actorType: 'USER',
      actorId: 'user',
      action: 'PROJECT_CREATE',
      targetType: 'PROJECT',
      targetId: project.id,
      metadata: {
        name: data.name,
        folderPath: data.folderPath,
      },
    });
  } catch (err) {
    logger.error('Failed to record activity', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    project: await prisma.project.findUnique({
      where: { id: project.id },
      include: { orchestrator: true, documentation: true },
    }),
    agents,
  };
}

/**
 * Ensure all agent template instances exist for a company.
 * Creates missing agents from templates. Returns all agents.
 */
async function ensureAgentsExist(companyId: string) {
  const existingAgents = await prisma.agent.findMany({
    where: { companyId, isTemplate: true },
  });

  const existingKeys = new Set(existingAgents.map(a => a.templateKey));
  const created: typeof existingAgents = [];

  for (const template of AGENT_TEMPLATES) {
    if (existingKeys.has(template.key)) continue;

    // Find manager agent
    let managerId: string | null = null;
    if (template.reportsTo) {
      const manager = existingAgents.find(a => a.templateKey === template.reportsTo)
        || created.find(a => a.templateKey === template.reportsTo);
      if (manager) managerId = manager.id;
    }

    try {
      const agent = await prisma.agent.create({
        data: {
          companyId,
          name: template.name,
          role: template.role,
          title: template.title,
          managerId,
          status: 'ACTIVE',
          isTemplate: true,
          templateKey: template.key,
          config: {
            systemPrompt: template.systemPrompt,
            tools: template.tools,
            responsibilities: template.responsibilities,
          },
        },
      });

      created.push(agent);
      logger.info('Agent created from template', {
        agentId: agent.id,
        name: agent.name,
        role: agent.role,
        templateKey: template.key,
      });
    } catch (err) {
      logger.error('Failed to create agent from template', {
        templateKey: template.key,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue with other agents
    }
  }

  // Re-fetch all agents to return complete list
  return prisma.agent.findMany({
    where: { companyId, isTemplate: true },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Documentation Phase ───────────────────────────────────────

/**
 * Start the documentation phase for a project.
 * Creates tasks for PRD, Architecture, and Stories generation.
 * The orchestrator delegates to the appropriate agents.
 */
export async function startDocumentationPhase(projectId: string, companyId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { documentation: true },
  });

  if (!project) throw new Error('Project not found');
  if (project.companyId !== companyId) throw new Error('Access denied');

  // Update project status
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: 'DOCUMENTATION',
      phase: 'DOCUMENTATION',
    },
  });

  // Create a goal for the documentation phase
  const goal = await prisma.goal.create({
    data: {
      projectId,
      name: 'Project Documentation',
      status: 'IN_PROGRESS',
      phase: 'DOCUMENTATION',
    },
  });

  // Get agents
  const productOwner = await prisma.agent.findFirst({
    where: { companyId, templateKey: 'product-owner' },
  });
  const architect = await prisma.agent.findFirst({
    where: { companyId, templateKey: 'solution-architect' },
  });
  const scrumMaster = await prisma.agent.findFirst({
    where: { companyId, templateKey: 'scrum-master' },
  });

  // Create tasks for documentation generation (sequential: PRD → Architecture → Stories)
  const tasks = [];

  if (productOwner) {
    const prdTask = await prisma.task.create({
      data: {
        goalId: goal.id,
        assigneeId: productOwner.id,
        title: 'Create Product Requirements Document (PRD)',
        description: `Based on the project description:\n\n${project.description}\n\nCreate a comprehensive PRD. Ask clarifying questions if the description is vague.`,
        status: 'TODO',
        priority: 'HIGH',
      },
    });
    tasks.push(prdTask);
  }

  if (architect) {
    const archTask = await prisma.task.create({
      data: {
        goalId: goal.id,
        assigneeId: architect.id,
        title: 'Create Architecture Document',
        description: 'Based on the approved PRD, create the technical architecture document. Define tech stack, data model, API design, and project structure.',
        status: 'BACKLOG', // Blocked until PRD is approved
        priority: 'HIGH',
      },
    });
    tasks.push(archTask);
  }

  if (scrumMaster) {
    const storiesTask = await prisma.task.create({
      data: {
        goalId: goal.id,
        assigneeId: scrumMaster.id,
        title: 'Break Down Development Stories',
        description: 'Based on the approved architecture, break down the project into development stories with clear acceptance criteria and dependencies.',
        status: 'BACKLOG', // Blocked until architecture is approved
        priority: 'HIGH',
      },
    });
    tasks.push(storiesTask);
  }

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'SYSTEM',
    actorId: 'orchestrator',
    action: 'PHASE_START',
    targetType: 'PROJECT',
    targetId: projectId,
    metadata: { phase: 'DOCUMENTATION', tasksCreated: tasks.length },
  });

  logger.info('Documentation phase started', {
    projectId,
    tasksCreated: tasks.length,
  });

  // Auto-trigger the first task (PRD) — fire and forget
  const prdTask = tasks[0];
  if (prdTask && productOwner) {
    executeDocumentationTask(prdTask.id, productOwner.id, projectId, companyId).catch((err) => {
      logger.error('Failed to auto-trigger PRD task', {
        taskId: prdTask.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return { goal, tasks };
}

// ── Auto-Execution ────────────────────────────────────────────

/**
 * Execute a documentation task by triggering a heartbeat.
 * This is called automatically when tasks are created or when
 * the previous task completes.
 */
async function executeDocumentationTask(
  taskId: string,
  agentId: string,
  projectId: string,
  companyId: string
) {
  // Update task status to IN_PROGRESS
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'IN_PROGRESS' },
  });

  // Build a context-rich prompt for the agent
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { goal: { include: { project: true } } },
  });

  const prompt = task
    ? `Project: ${task.goal.project.name}\nFolder: ${task.goal.project.folderPath}\n\n${task.description || task.title}`
    : undefined;

  // Trigger heartbeat (async execution)
  const result = await triggerHeartbeat(
    agentId,
    {
      taskId,
      triggerType: 'MANUAL',
      prompt,
    },
    companyId
  );

  logger.info('Documentation task execution triggered', {
    taskId,
    agentId,
    projectId,
    heartbeatId: result.heartbeatId,
    status: result.status,
  });

  return result;
}

/**
 * Advance the documentation phase when a task completes.
 *
 * This function is called by the heartbeat service when a heartbeat
 * completes. It checks if the completed task was a documentation task
 * and triggers the next task in the sequence.
 *
 * Flow: PRD (done) -> Architecture (trigger) -> Stories (trigger) -> READY
 */
export async function advanceDocumentationPhase(
  completedTaskId: string,
  companyId: string
) {
  // Find the completed task and its goal
  const completedTask = await prisma.task.findUnique({
    where: { id: completedTaskId },
    include: {
      goal: {
        include: {
          project: { include: { documentation: true } },
          tasks: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });

  if (!completedTask) return;

  const goal = completedTask.goal;
  const project = goal.project;

  // Only handle documentation phase tasks
  if (goal.phase !== 'DOCUMENTATION') return;

  // Mark completed task as DONE
  await prisma.task.update({
    where: { id: completedTaskId },
    data: { status: 'DONE' },
  });

  // Check which documentation task was completed
  const taskTitle = completedTask.title.toLowerCase();
  const doc = project.documentation;

  if (taskTitle.includes('prd') || taskTitle.includes('requirements')) {
    // PRD is done — save it to documentation, trigger Architecture
    if (doc) {
      // The PRD content should be in the heartbeat output/artifacts
      // For now, mark PRD as generated
      await prisma.projectDocumentation.update({
        where: { projectId: project.id },
        data: { status: 'GENERATING' },
      });
    }

    // Unblock Architecture task
    const archTask = goal.tasks.find(
      (t) => t.title.toLowerCase().includes('architecture') && t.status === 'BACKLOG'
    );
    if (archTask && archTask.assigneeId) {
      await prisma.task.update({
        where: { id: archTask.id },
        data: { status: 'TODO' },
      });

      // Auto-trigger Architecture task
      executeDocumentationTask(archTask.id, archTask.assigneeId, project.id, companyId).catch(
        (err) => {
          logger.error('Failed to auto-trigger Architecture task', {
            taskId: archTask.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      );
    }
  } else if (taskTitle.includes('architecture')) {
    // Architecture is done — trigger Stories
    const storiesTask = goal.tasks.find(
      (t) => t.title.toLowerCase().includes('stories') && t.status === 'BACKLOG'
    );
    if (storiesTask && storiesTask.assigneeId) {
      await prisma.task.update({
        where: { id: storiesTask.id },
        data: { status: 'TODO' },
      });

      // Auto-trigger Stories task
      executeDocumentationTask(storiesTask.id, storiesTask.assigneeId, project.id, companyId).catch(
        (err) => {
          logger.error('Failed to auto-trigger Stories task', {
            taskId: storiesTask.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      );
    }
  } else if (taskTitle.includes('stories') || taskTitle.includes('break down')) {
    // Stories are done — mark documentation as READY for user approval
    if (doc) {
      await prisma.projectDocumentation.update({
        where: { projectId: project.id },
        data: {
          status: 'READY',
          generatedAt: new Date(),
        },
      });

      // Update project status
      await prisma.project.update({
        where: { id: project.id },
        data: {
          status: 'AWAITING_APPROVAL',
        },
      });
    }

    // Mark goal as completed
    await prisma.goal.update({
      where: { id: goal.id },
      data: { status: 'COMPLETED' },
    });

    logger.info('Documentation phase completed — awaiting user approval', {
      projectId: project.id,
    });
  }

  logger.info('Documentation phase advanced', {
    completedTask: completedTask.title,
    projectId: project.id,
  });
}

// ── Question Management ───────────────────────────────────────

/**
 * An agent asks a question to the user.
 * This pauses the agent's execution until the user answers.
 */
export async function agentAskQuestion(
  projectId: string,
  agentId: string,
  question: string,
  context?: string,
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'BLOCKING' = 'NORMAL',
  heartbeatId?: string
) {
  const q = await prisma.agentQuestion.create({
    data: {
      projectId,
      agentId,
      heartbeatId,
      question,
      context,
      priority,
      status: 'PENDING',
    },
    include: { agent: true },
  });

  // If question is blocking, pause the project
  if (priority === 'BLOCKING') {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'PAUSED' },
    });
  }

  // Record activity
  await recordActivity({
    companyId: (await prisma.project.findUnique({ where: { id: projectId } }))!.companyId,
    actorType: 'AGENT',
    actorId: agentId,
    action: 'AGENT_QUESTION',
    targetType: 'PROJECT',
    targetId: projectId,
    metadata: { questionId: q.id, question, priority },
  });

  logger.info('Agent asked question', {
    questionId: q.id,
    agentId,
    projectId,
    priority,
  });

  return q;
}

/**
 * User answers an agent's question.
 * This unblocks the agent and resumes execution.
 */
export async function answerQuestion(
  questionId: string,
  answer: string,
  companyId: string
) {
  const question = await prisma.agentQuestion.findUnique({
    where: { id: questionId },
    include: { project: true },
  });

  if (!question) throw new Error('Question not found');
  if (question.project.companyId !== companyId) throw new Error('Access denied');

  const updated = await prisma.agentQuestion.update({
    where: { id: questionId },
    data: {
      answer,
      status: 'ANSWERED',
      answeredAt: new Date(),
    },
  });

  // Check if there are remaining blocking questions
  const remainingBlocking = await prisma.agentQuestion.count({
    where: {
      projectId: question.projectId,
      status: 'PENDING',
      priority: 'BLOCKING',
    },
  });

  // If no more blocking questions, resume project
  if (remainingBlocking === 0 && question.project.status === 'PAUSED') {
    await prisma.project.update({
      where: { id: question.projectId },
      data: { status: 'DOCUMENTATION' }, // Resume to whatever phase it was in
    });
  }

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'user',
    action: 'QUESTION_ANSWERED',
    targetType: 'PROJECT',
    targetId: question.projectId,
    metadata: { questionId, answer },
  });

  logger.info('Question answered', { questionId, projectId: question.projectId });

  return updated;
}

/**
 * Get all pending questions for a project.
 */
export async function getPendingQuestions(projectId: string, companyId: string) {
  return prisma.agentQuestion.findMany({
    where: {
      projectId,
      status: 'PENDING',
      project: { companyId },
    },
    include: { agent: true },
    orderBy: [
      { priority: 'asc' }, // BLOCKING first
      { createdAt: 'asc' },
    ],
  });
}

// ── Documentation Approval ────────────────────────────────────

/**
 * User approves the documentation.
 * This transitions the project from DOCUMENTATION to DEVELOPMENT.
 */
export async function approveDocumentation(
  projectId: string,
  companyId: string,
  approved: boolean,
  rejectionReason?: string
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { documentation: true },
  });

  if (!project) throw new Error('Project not found');
  if (project.companyId !== companyId) throw new Error('Access denied');

  if (approved) {
    // Approve documentation
    await prisma.projectDocumentation.update({
      where: { projectId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    // Transition to development
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'DEVELOPMENT',
        phase: 'DEVELOPMENT',
      },
    });

    // Unblock architecture task (if PRD was the blocker)
    // This is handled by the orchestrator when it detects approval

    await recordActivity({
      companyId,
      actorType: 'USER',
      actorId: 'user',
      action: 'DOCUMENTATION_APPROVED',
      targetType: 'PROJECT',
      targetId: projectId,
      metadata: {},
    });

    logger.info('Documentation approved', { projectId });
    return { approved: true };
  } else {
    // Reject documentation
    await prisma.projectDocumentation.update({
      where: { projectId },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason || 'User rejected documentation',
      },
    });

    // Keep project in DOCUMENTATION phase for revision
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'DOCUMENTATION',
        phase: 'DOCUMENTATION',
      },
    });

    await recordActivity({
      companyId,
      actorType: 'USER',
      actorId: 'user',
      action: 'DOCUMENTATION_REJECTED',
      targetType: 'PROJECT',
      targetId: projectId,
      metadata: { reason: rejectionReason },
    });

    logger.info('Documentation rejected', { projectId, reason: rejectionReason });
    return { approved: false, reason: rejectionReason };
  }
}

// ── Project Status ────────────────────────────────────────────

/**
 * Get project with full details (documentation, questions, agents, tasks).
 */
export async function getProjectDetails(projectId: string, companyId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    include: {
      orchestrator: true,
      documentation: true,
      questions: {
        orderBy: { createdAt: 'desc' },
        include: { agent: true },
      },
      goals: {
        include: {
          tasks: {
            include: { assignee: true, heartbeats: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
}

/**
 * Update a project's name, description, or folder path.
 */
export async function updateProject(
  projectId: string,
  data: { name?: string; description?: string; folderPath?: string },
  companyId: string
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
  });

  if (!project) return null;

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.folderPath !== undefined && { folderPath: data.folderPath }),
    },
    include: { orchestrator: true, documentation: true },
  });

  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'user',
    action: 'PROJECT_UPDATE',
    targetType: 'PROJECT',
    targetId: projectId,
    metadata: data,
  });

  logger.info('Project updated', { projectId, changes: Object.keys(data) });

  return updated;
}

/**
 * Delete a project and all related data (cascades via Prisma relations).
 */
export async function deleteProject(projectId: string, companyId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
  });

  if (!project) return null;

  // Delete cascades: documentation, questions, goals -> tasks -> heartbeats
  await prisma.project.delete({
    where: { id: projectId },
  });

  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'user',
    action: 'PROJECT_DELETE',
    targetType: 'PROJECT',
    targetId: projectId,
    metadata: { name: project.name },
  });

  logger.info('Project deleted', { projectId, name: project.name });

  return project;
}

/**
 * List all projects for a company.
 */
export async function listProjects(companyId: string) {
  return prisma.project.findMany({
    where: { companyId },
    include: {
      orchestrator: true,
      documentation: true,
      _count: {
        select: { goals: true, questions: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
