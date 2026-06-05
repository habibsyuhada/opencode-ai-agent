# Product Requirement Document
Status: Ready

## 1. Idea Summary
ArmiAI is a SaaS platform that functions as a "Paperclip Alternative" specifically designed for tech companies. It provides specialized virtual employees (agents) that emulate tech roles (e.g., CEO, CTO, Developers, QA, Scrum Master). The platform exclusively uses OpenCode as its execution engine, bridging the gap between a CLI-based prototype and a full SaaS web UI to manage software development workflows.

## 2. Background
The project originated as a CLI-based configuration template (`old_version/v2`) relying on file-based state. To scale and offer a comprehensive management solution, it is transitioning into a monorepo-based SaaS application (Hono server, PostgreSQL + Prisma, React UI). This evolution shifts the paradigm from generic virtual assistants to structured, hierarchical tech teams that automate the software development lifecycle from idea to release.

## 3. Problem Statement
Tech companies need an automated, scalable way to manage software development workflows using AI agents. Existing solutions like Paperclip offer general-purpose virtual assistants, which lack the specialized roles, hierarchical organization (org charts), and deep integration with developer tools (like OpenCode) required to efficiently execute complex software engineering tasks autonomously.

## 4. Goals
- Build a full SaaS platform (Backend + UI) to replace the old file-based CLI prototype.
- Implement a hierarchical organization system for virtual tech employees (Org Chart).
- Utilize OpenCode exclusively as the execution engine for agent tasks.
- Provide robust task management, budget tracking, and governance (approvals).
- Maintain 5 clear phases of implementation: Foundation, Core Engine, Budget & Governance, Dashboard UI, Advanced Features.

## 5. Non-Goals
- Building a new AI model from scratch.
- Creating general-purpose virtual assistants (e.g., for customer support or general admin tasks outside of tech/software dev).
- Replacing OpenCode with a different agent execution framework.

## 6. Target Users
- **Software Development Teams:** Looking to augment their workforce with specialized AI agents.
- **Tech Founders / CTOs:** Seeking to automate the software development lifecycle (Idea -> PRD -> Arch -> Dev -> QA).
- **Project Managers / Scrum Masters:** Needing automated task execution, tracking, and budget management.

## 7. User Journey
1. **Onboarding:** A user signs up and creates a "Company" profile.
2. **Hiring:** The user "hires" virtual employees by assigning them specific tech roles (e.g., Developer, QA) based on templates.
3. **Planning:** The user creates a project, defining goals and breaking them down into actionable tasks (tickets).
4. **Execution:** The system's Heartbeat engine automatically assigns tasks to available agents based on the org chart.
5. **Monitoring:** The OpenCode adapter executes the tasks. The user monitors progress, reviews artifacts, and tracks token usage/costs via the Dashboard.
6. **Governance:** Critical actions (like deployment or budget expansion) trigger approval workflows requiring user intervention.

## 8. User Stories
- As a **CTO**, I want to visualize my AI team's org chart so that I can understand reporting lines and responsibilities.
- As a **Project Manager**, I want to assign specific tech tasks (like code review) to specialized AI agents so that the development workflow is automated.
- As a **Founder**, I want to set a monthly budget for my AI team so that I can control token costs and prevent unexpected expenses.
- As a **Developer**, I want the platform to seamlessly trigger OpenCode for task execution so that I don't have to manually run CLI commands for every ticket.

## 9. Functional Requirements
- **FR-001 [Monorepo Setup]:** Establish a monorepo with `packages/server`, `packages/ui`, `packages/shared`, and `packages/cli`.
- **FR-002 [Database]:** Implement a PostgreSQL schema via Prisma for multi-tenant Companies, Agents, Tasks, Budgets, and Approvals.
- **FR-003 [Server API]:** Build a Hono-based REST/RPC server with typed endpoints for all database models.
- **FR-004 [Agent Roles]:** Support specialized tech roles (e.g., Developer, QA, Scrum Master) based on migrated `opencode.json` templates.
- **FR-005 [Task Management]:** Provide a system for Projects, Goals, and Tasks with atomic checkouts to prevent concurrency issues.
- **FR-006 [OpenCode Adapter]:** Create an adapter to spawn OpenCode child processes, pass prompts, capture artifacts, and record token usage.
- **FR-007 [Heartbeat Engine]:** Implement an execution loop to check status, resolve tasks, load skills, and run the OpenCode adapter.
- **FR-008 [Budgeting]:** Track costs per agent/task, enforce monthly limits, and trigger auto-pauses on exceedance.
- **FR-009 [Governance]:** Implement approval workflows for critical agent actions.
- **FR-010 [Dashboard UI]:** Build a React-based interface featuring Kanban boards, Org Chart visualization, and cost tracking.

## 10. Non-Functional Requirements
- **NFR-001 [Performance]:** Core API endpoints must respond in under 100ms.
- **NFR-002 [Security]:** Strict multi-tenant data isolation must be enforced at the database level.
- **NFR-003 [Reliability]:** The Heartbeat engine must gracefully handle and recover from OpenCode process failures.
- **NFR-004 [Security]:** Secrets (API keys) must be encrypted at rest and only injected during active heartbeat executions.

## 11. Data Requirements
- **PostgreSQL (Prisma):** Entities include Company, User, Agent (with role templates), Project, Goal, Task, HeartbeatRun, Budget, CostEvent, Approval, ActivityEvent, Routine, and Secret.
- **File System:** Code and markdown artifacts must remain on disk to interface seamlessly with OpenCode tools.

## 12. Integration Requirements
- **OpenCode CLI:** The system must interface directly with the local or cloud OpenCode CLI as the sole agent execution engine.
- **File System/Workspace:** The platform must read/write to local or mounted project directories where OpenCode operates.

## 13. Acceptance Criteria
- **AC-001:** The monorepo structure is established and builds successfully.
- **AC-002:** The database schema correctly supports multi-company isolation and agent hierarchies.
- **AC-003:** The OpenCode adapter successfully spawns a process, executes a task, and logs the result and cost to the database.
- **AC-004:** The React Dashboard accurately displays tasks, budgets, and the agent org chart, pulling live data from the Hono server.
- **AC-005:** The five distinct implementation phases (Foundation, Core Engine, Budget & Governance, Dashboard UI, Advanced Features) are clearly reflected in the project roadmap and architecture.

## 14. Risks
- **OpenCode Process Management:** Spawning and managing child processes reliably, especially handling timeouts or zombie processes, can be complex.
- **State Syncing:** Keeping the PostgreSQL database state synchronized with the actual file-system state modified by OpenCode agents.
- **Token Costs:** Unbounded agent loops could rapidly consume API credits if budget controls fail.

## 15. Assumptions
- Users have OpenCode CLI installed and configured in their environment.
- PostgreSQL will be used (via `pg` or an embedded solution for local dev).
- The transition from file-based `docs/flow-state/` to PostgreSQL is a one-way migration for metadata, while code remains on disk.

## 16. Out of Scope
- Building native mobile applications (mobile web responsiveness is sufficient).
- Replacing standard Git version control (the system orchestrates tasks, but relies on Git for versioning).
- Creating custom LLMs; the system relies entirely on OpenCode's LLM integrations.