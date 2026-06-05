# Implementation Plan: ArmiAI (Paperclip Alternative for Tech Companies)

## 1. Executive Summary
ArmiAI is evolving from a CLI-based configuration template (prototype in `old_version/v2`) into a full-fledged SaaS platform, serving as a tech-company-focused alternative to Paperclip (paperclipai/paperclip). 

Unlike Paperclip, which provides general-purpose virtual employees, ArmiAI specifically targets software development workflows, utilizing **OpenCode** as the exclusive agent execution engine. It models a virtual tech company complete with Org Charts (CEO, CTO, Developers, QA), project boards (Tasks, Goals), budgets, approvals, and automated execution schedules.

## 2. Core Differences from Paperclip
| Feature | Paperclip | ArmiAI |
| :--- | :--- | :--- |
| **Focus** | General Virtual Employees | Software Engineering / Tech Companies |
| **Agent Engine** | Proprietary/Varied | OpenCode (Local/Cloud CLI) |
| **Workflow** | General Tasks | Idea → PRD → Arch → Dev → QA → Release |
| **Org Structure** | Individual Assistants | Hierarchical Tech Roles (e.g., Scrum Master, PR Reviewer) |
| **Execution** | Cloud UI | Hono Backend + OpenCode Process Spawning |

## 3. System Architecture

### 3.1 Stack
- **Database:** PostgreSQL (embedded `pg` for local dev) + Prisma ORM
- **Backend:** Hono (Node.js adapter)
- **Frontend:** React + Vite + Tailwind CSS + Tanstack Query
- **CLI:** `armiai` (Node.js script wrapping OpenCode execution)
- **Agent:** OpenCode

### 3.2 Monorepo Structure
```text
/
├── packages/
│   ├── shared/    # Shared TypeScript types (Agent, Task, Budget, Heartbeat)
│   ├── server/    # Hono API, Prisma DB, OpenCode execution engine
│   ├── ui/        # React Dashboard (Workspace UI)
│   └── cli/       # User terminal interface (install, onboard, sync)
```

## 4. Execution Engine (The "Heartbeat")
The core of ArmiAI is the Heartbeat loop. Instead of long-running LLM threads, ArmiAI manages discrete task executions.

1. **Trigger:** A routine fires or a task is assigned.
2. **Pre-flight:** The Hono server checks the agent's status and budget.
3. **Execution:** The server invokes the OpenCode adapter, spawning an `opencode` child process with the specific agent profile (from the old_version templates) and the task prompt.
4. **Post-flight:** The server captures the exit status, parses output artifacts, calculates token usage/cost, and updates the task and budget records in PostgreSQL.

## 5. Development Phases

### Phase 1: Foundation (Current Target)
- Setup Monorepo (`pnpm-workspace.yaml`, Typescript configs).
- Design and implement Prisma Schema (Companies, Agents, Tasks, Budgets).
- Scaffold Hono server and basic CRUD endpoints.
- Scaffold React dashboard shell.

### Phase 2: Org Chart & Task Management
- Implement Agent hiring (role templates like 'scrum-master', 'developer').
- Implement Task management with atomic checkouts (locking tasks so only one OpenCode agent works on it at a time).
- Integrate `docs/flow-state/` checkpointing logic from the prototype into the database.

### Phase 3: Engine & OpenCode Adapter
- Build the OpenCode execution adapter in `packages/server`.
- Implement cost tracking and budget threshold warnings.
- Build the Heartbeat monitor in the UI.

### Phase 4: Governance & UI Polish
- Implement Approval workflows for critical tasks (e.g., merging to main, expanding budget).
- Complete the React dashboard (Kanban boards, Org Chart visualizer, Cost graphs).

## 6. Migration from Prototype (`old_version/`)
The prototype relied heavily on file-based state (`docs/flow-state/flow-state.json`) and raw markdown files (`PRD.md`, `STORY.md`).
- **Data:** This state will move into PostgreSQL.
- **Prompts:** The specialized agent prompts in `old_version/v2/template/.opencode/prompts/` will be preserved and seeded into the DB as Agent Role Templates.
- **Artifacts:** Code and markdown documents will still live on disk (to interface with OpenCode tools), but metadata (status, assignee, budget) lives in the DB.
