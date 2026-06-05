# Database Schema & API Design

## 1. Prisma Schema Design
The following is the planned structure for `packages/server/prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Company {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  mission   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  agents         Agent[]
  projects       Project[]
  budgets        Budget[]
  approvals      Approval[]
  activityEvents ActivityEvent[]
  routines       Routine[]
  secrets        Secret[]
  workspaces     Workspace[]
}

model Workspace {
  id        String   @id @default(cuid())
  companyId String
  path      String   // Absolute path to the physical workspace on disk
  createdAt DateTime @default(now())

  company   Company  @relation(fields: [companyId], references: [id])
}

model Agent {
  id        String   @id @default(cuid())
  companyId String
  name      String
  role      String   // e.g., 'scrum-master', 'developer', 'qa-engineer'
  title     String?
  managerId String?  // Self-relation for org chart
  status    String   @default("ACTIVE") // ACTIVE, PAUSED, TERMINATED
  config    Json?    // Optional overrides for the OpenCode template
  createdAt DateTime @default(now())

  company   Company  @relation(fields: [companyId], references: [id])
  manager   Agent?   @relation("OrgChart", fields: [managerId], references: [id])
  reports   Agent[]  @relation("OrgChart")
  tasks     Task[]   @relation("TaskAssignee")
  budgets   Budget[]
  heartbeats Heartbeat[]
}

model Project {
  id        String   @id @default(cuid())
  companyId String
  name      String
  createdAt DateTime @default(now())

  company   Company  @relation(fields: [companyId], references: [id])
  goals     Goal[]
}

model Goal {
  id        String   @id @default(cuid())
  projectId String
  name      String
  status    String   @default("PENDING")

  project   Project  @relation(fields: [projectId], references: [id])
  tasks     Task[]
}

model Task {
  id          String   @id @default(cuid())
  goalId      String
  assigneeId  String?
  title       String
  description String?
  status      String   @default("BACKLOG") // BACKLOG, TODO, IN_PROGRESS, REVIEW, DONE
  priority    String   @default("MEDIUM")
  lockedAt    DateTime? // Used for atomic checkout
  artifacts   Json?     // Array of paths (e.g., ['docs/stories/STORY-001.md'])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  goal        Goal     @relation(fields: [goalId], references: [id])
  assignee    Agent?   @relation("TaskAssignee", fields: [assigneeId], references: [id])
  heartbeats  Heartbeat[]
}

model Heartbeat {
  id         String   @id @default(cuid())
  taskId     String
  agentId    String
  status     String   @default("PENDING") // PENDING, RUNNING, COMPLETED, FAILED
  startedAt  DateTime?
  endedAt    DateTime?
  log        String?
  tokensUsed Int      @default(0)
  cost       Float    @default(0.0)

  task       Task     @relation(fields: [taskId], references: [id])
  agent      Agent    @relation(fields: [agentId], references: [id])
  costEvents CostEvent[]
}

model Budget {
  id        String   @id @default(cuid())
  companyId String
  agentId   String?  // If null, represents the global company budget
  monthly   Float
  used      Float    @default(0.0)
  currency  String   @default("USD")
  threshold Float    @default(0.8) // 80%

  company   Company  @relation(fields: [companyId], references: [id])
  agent     Agent?   @relation(fields: [agentId], references: [id])
}

model CostEvent {
  id          String   @id @default(cuid())
  heartbeatId String
  provider    String
  model       String
  tokensIn    Int
  tokensOut   Int
  cost        Float
  createdAt   DateTime @default(now())

  heartbeat   Heartbeat @relation(fields: [heartbeatId], references: [id])
}

model Approval {
  id          String   @id @default(cuid())
  companyId   String
  type        String
  requestedBy String   // Agent or System
  targetType  String
  targetId    String
  status      String   @default("PENDING") // PENDING, APPROVED, REJECTED
  decision    String?
  reason      String?
  createdAt   DateTime @default(now())

  company     Company  @relation(fields: [companyId], references: [id])
}

model ActivityEvent {
  id         String   @id @default(cuid())
  companyId  String
  actorType  String   // 'USER' or 'AGENT' or 'SYSTEM'
  actorId    String
  action     String
  targetType String
  targetId   String
  metadata   Json?
  createdAt  DateTime @default(now())

  company    Company  @relation(fields: [companyId], references: [id])
}

model Routine {
  id         String   @id @default(cuid())
  companyId  String
  agentId    String?
  name       String
  cron       String
  action     String   // System action to trigger
  enabled    Boolean  @default(true)

  company    Company  @relation(fields: [companyId], references: [id])
}

model Secret {
  id             String   @id @default(cuid())
  companyId      String
  name           String
  encryptedValue String
  scope          String   // 'GLOBAL' or 'AGENT'

  company        Company  @relation(fields: [companyId], references: [id])
}
```

## 2. Core API Endpoints (Hono)

All endpoints expect an `X-Company-Id` header (or extract it from JWT auth) to ensure multi-tenant isolation.

### Agents
- `GET /api/agents` -> Returns all agents, optionally structured as a tree.
- `POST /api/agents` -> Hires a new agent (requires role, maps to opencode.json).
- `PATCH /api/agents/:id` -> Updates agent status (PAUSE/RESUME).

### Tasks
- `GET /api/tasks` -> Returns Kanban tasks.
- `POST /api/tasks` -> Creates a new task.
- `POST /api/tasks/:id/checkout` -> **ATOMIC OPERATION**. Attempts to lock a task. Returns 409 if already locked by another agent.
- `POST /api/tasks/:id/release` -> Unlocks task, updates status to DONE/BLOCKED, attaches file artifacts.

### Heartbeat (Execution Engine)
- `POST /api/agents/:agentId/heartbeat` -> Triggers an immediate execution loop for an agent.
- `GET /api/heartbeats/:id` -> Polls status of a running execution.

### Budget & Governance
- `GET /api/budgets` -> Returns budget breakdown.
- `GET /api/approvals` -> Returns pending approvals (e.g., CTO requesting to merge to main).
- `POST /api/approvals/:id/approve` -> Grants the approval.

## 3. The OpenCode Adapter Flow
When a Heartbeat starts:
1. Fetch `Task.prompt`.
2. Fetch `Agent.role` and lookup its config in the `old_version/v2/template/.opencode/opencode.json`.
3. Extract `Agent.skills` to load.
4. Spawn `opencode` CLI:
   ```bash
   opencode run --agent <role> --prompt <Task.prompt> --skills <skills> --workspace <Workspace.path>
   ```
5. Capture structured output to extract Tokens used.
6. Write to `Heartbeat`, `CostEvent`, and update `Budget`.
