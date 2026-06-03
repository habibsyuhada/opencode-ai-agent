# ArmiAI

**ArmiAI** is an installable ECC-style AI agent workspace for OpenCode. It helps you run a structured, company-style software delivery workflow from raw idea to release using specialized AI agents.

Instead of manually copying `.opencode` files into every project, ArmiAI installs a reusable OpenCode agent workspace and links it into your project.

---

## What is ArmiAI?

ArmiAI turns your project into a resumable multi-agent workspace.

The main agent is **Armi**, your project orchestrator. You talk to Armi, and Armi delegates work to the right specialist agent, such as Product Owner, Solution Architect, Developer, Frontend Developer, QA Engineer, Security Reviewer, Bugfix Developer, and Release Engineer.

The core workflow is:

```text
Idea
→ PRD
→ Architecture
→ Story Sharding
→ Story Queue
→ Development
→ Review
→ QA
→ Bugfix
→ Release
```

ArmiAI is designed for projects where you want AI agents to behave more like a small software company instead of a single generic coding assistant.

---

## Features

- **Single entry point agent**
  - Talk to `Armi`, and it routes tasks to the right subagent.

- **Company-style workflow**
  - Product Owner, Architect, Scrum Master, Developer, QA, Security, Docs, Release, and more.

- **OpenCode-compatible structure**
  - Includes agents, commands, skills, tools, plugins, and global instructions.

- **Resumable workflow**
  - Stores lightweight checkpoint state in `docs/flow-state/`.

- **Low-token continuity**
  - Saves only metadata, status, artifact paths, and next actions.
  - Does not store full prompts or long model responses.

- **Migration support**
  - Can scan an existing partially completed project and continue from the next unfinished stage.

- **Frontend-specific agents**
  - Includes dedicated frontend development and frontend review agents for better UI quality.

- **Quality gates**
  - Supports QA, build checks, code review, security review, and release governance.

---

## Installation

Install globally from npm:

```bash
npm install -g armiai
```

Check that the CLI is available:

```bash
armiai doctor
```

---

## Usage

Go to your project root:

```bash
cd /path/to/your/project
```

Install ArmiAI into the project:

```bash
armiai install
```

This will add an `.opencode` workspace to your project.

By default, ArmiAI tries to use a symlink so the shared template can be reused across projects.

If symlink is not supported on your system, use:

```bash
armiai install --copy
```

---

## Commands

### Install ArmiAI into a project

```bash
armiai install
```

Creates or links the `.opencode` workspace in the current project.

---

### Migrate an existing project

```bash
armiai migrate
```

Scans existing workflow artifacts such as:

```text
docs/prd/prd.md
docs/architecture/architecture.md
docs/stories/STORY-xxx.md
docs/queue/dev-queue.md
docs/dev-notes/DEV-NOTES-STORY-xxx.md
docs/qa/QA-REVIEW-STORY-xxx.md
docs/release/merge-close-STORY-xxx.md
```

Then creates checkpoint metadata in:

```text
docs/flow-state/
```

Use this when your project was already started before installing ArmiAI.

---

### Show workflow status

```bash
armiai status
```

Displays the current project workflow state.

---

### Show resume plan

```bash
armiai resume-plan
```

Shows what Armi should do next based on the current checkpoint.

---

### Update project link

```bash
armiai update
```

Re-links the project `.opencode` workspace to the globally installed ArmiAI template.

---

### Uninstall from project

```bash
armiai uninstall
```

Removes the project `.opencode` link or copied workspace.

This does not delete your project source code or `docs/flow-state/`.

---

## OpenCode Usage

After installing ArmiAI into a project, open the project with OpenCode and talk to the main agent:

```text
Armi, create a new product workflow from this idea:
I want to build a simple inventory management app for small shops.
```

Or continue an existing project:

```text
Armi, continue this project from the current checkpoint. Do not redo completed stories.
```

Or improve a specific area:

```text
Armi, the frontend result for STORY-003 is weak. Improve the UI and run frontend review.
```

---

## Main Agent

### Armi

Armi is the default orchestrator agent.

Responsibilities:

- Understand the user's request.
- Decide whether the request needs full company workflow or direct specialist routing.
- Delegate work to the correct subagent.
- Enforce workflow gates.
- Verify required files exist before moving to the next stage.
- Use checkpoint state to avoid repeating completed work.
- Keep project progress traceable through real files.

---

## Included Agents

ArmiAI includes the following agents:

| Agent | Role |
|---|---|
| `armi` | Main orchestrator and single entry point |
| `product-owner` | Creates PRD from raw idea |
| `solution-architect` | Creates architecture document |
| `story-sharding-agent` | Breaks PRD and architecture into development stories |
| `scrum-master` | Queues stories, reviews completion, manages release gates |
| `planner` | Creates implementation plans |
| `developer` | General implementation agent |
| `frontend-developer` | Builds UI and frontend components |
| `frontend-reviewer` | Reviews UI quality, accessibility, responsiveness, and UX |
| `backend-developer` | Builds backend logic, APIs, services, and integrations |
| `tdd-engineer` | Guides test-first development |
| `build-error-resolver` | Fixes build, lint, and type errors |
| `code-reviewer` | Reviews code quality and maintainability |
| `security-reviewer` | Reviews security risks and unsafe patterns |
| `database-reviewer` | Reviews schema, queries, migrations, and database design |
| `qa-engineer` | Runs QA review and writes QA reports |
| `bugfix-developer` | Fixes bugs found by QA |
| `e2e-runner` | Runs end-to-end validation |
| `docs-updater` | Updates documentation |
| `refactor-cleaner` | Cleans up dead code and improves structure |
| `devops-release-engineer` | Handles release notes and deployment readiness |

---

## Included Commands

ArmiAI includes OpenCode command definitions such as:

```text
/armi
/company-flow
/prd
/architecture
/shard-stories
/queue-story
/plan
/develop
/frontend
/frontend-review
/backend
/tdd
/build-fix
/code-review
/security
/database-review
/qa
/bugfix
/e2e
/update-docs
/refactor-clean
/release
/verify
/status
/resume
/checkpoint
/migrate-flow
```

You do not need to memorize these commands. They exist so Armi can route work more consistently.

---

## Included Skills

ArmiAI includes reusable skills and standards:

- `company-flow`
- `continuity-state`
- `coding-standards`
- `frontend-patterns`
- `backend-patterns`
- `api-design`
- `tdd-workflow`
- `verification-loop`
- `security-review`
- `database-patterns`
- `e2e-testing`
- `documentation-standards`
- `release-governance`

These skills help agents produce more consistent output across projects.

---

## Included Tools

ArmiAI includes utility tools for project verification and workflow state:

- `changed-files`
- `check-coverage`
- `checkpoint-migrate`
- `checkpoint-read`
- `checkpoint-write`
- `flow-status`
- `git-summary`
- `lint-check`
- `resume-plan`
- `run-tests`
- `security-audit`
- `verify-artifacts`

---

## Checkpoint and Resume

ArmiAI stores lightweight project continuity data in:

```text
docs/flow-state/
```

Example files:

```text
docs/flow-state/flow-state.json
docs/flow-state/story-state/STORY-001.json
docs/flow-state/MIGRATION-REPORT.md
```

The checkpoint system is intentionally minimal.

It stores:

- Story ID
- Current stage
- Completed stages
- Pending stages
- Output artifact paths
- Status
- Last known next action

It does not store:

- Full AI responses
- Full prompts
- Full source files
- Long project history

This keeps continuity useful without wasting context tokens.

---

## Working With Existing Projects

If you already have a project that was partially completed manually or by another agent, run:

```bash
armiai install
armiai migrate
armiai status
armiai resume-plan
```

Then tell Armi:

```text
Armi, continue this project from the current checkpoint. Do not redo completed stories.
```

For example, if your project has 20 stories and 5 are already completed, ArmiAI should detect the completed artifacts and continue from the next unfinished story or stage.

---

## Recommended Project Artifacts

ArmiAI expects workflow files under `docs/`:

```text
docs/
  prd/
    prd.md
  architecture/
    architecture.md
  stories/
    STORY-001.md
    STORY-002.md
  queue/
    dev-queue.md
    completion-review-STORY-001.md
  dev-notes/
    DEV-NOTES-STORY-001.md
    BUGFIX-NOTES-STORY-001.md
  qa/
    QA-REVIEW-STORY-001.md
    BUG-REPORT-STORY-001.md
  release/
    merge-close-STORY-001.md
  flow-state/
    flow-state.json
    story-state/
```

---

## Suggested Workflow

### Start a new project

```bash
mkdir my-project
cd my-project
armiai install
```

Then in OpenCode:

```text
Armi, build this idea using the full company workflow:
[describe your app idea here]
```

---

### Continue a partially completed project

```bash
cd my-project
armiai install
armiai migrate
armiai resume-plan
```

Then in OpenCode:

```text
Armi, continue from the checkpoint and only run unfinished stages.
```

---

### Improve frontend quality

```text
Armi, review the frontend output for the current story. Improve layout, spacing, responsiveness, loading states, empty states, and accessibility.
```

---

### Fix QA bug

```text
Armi, fix the bugs reported by QA for STORY-004 and send it back for QA recheck.
```

---

## Publishing and Versioning

Current npm package:

```text
armiai
```

Install:

```bash
npm install -g armiai
```

When releasing a new version:

```bash
npm version patch
npm publish --access public
```

---

## Troubleshooting

### `armiai` command not found

Try reinstalling globally:

```bash
npm install -g armiai
```

Check npm global bin path:

```bash
npm bin -g
```

Make sure the global npm bin path is available in your system `PATH`.

---

### Symlink failed on Windows

Use copy mode:

```bash
armiai install --copy
```

---

### OpenCode does not detect the workspace

Make sure `.opencode` exists in the project root:

```bash
ls -la .opencode
```

On Windows PowerShell:

```powershell
dir .opencode
```

---

### Resume does not detect completed work

Run migration again:

```bash
armiai migrate
armiai status
armiai resume-plan
```

Check whether expected files exist under `docs/`.

---

## Design Principles

ArmiAI follows these principles:

1. **One user entry point**
   - The user talks to Armi, not every subagent manually.

2. **Company-style delegation**
   - Each agent has a clear role.

3. **Traceable outputs**
   - Every major stage creates a real file on disk.

4. **No silent stage skipping**
   - Workflow gates must be satisfied before moving forward.

5. **Low-token continuity**
   - Checkpoints store status metadata, not long chat logs.

6. **Frontend deserves specialization**
   - Frontend work is handled by dedicated frontend agents.

7. **Safe by default**
   - Dangerous shell operations are restricted by policy and hooks.

---

## License

MIT

---

## Author

Created for AI-assisted product-to-release software workflows using OpenCode.
