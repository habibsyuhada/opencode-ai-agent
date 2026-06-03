# ArmiAI — Installable v1

ECC-style ArmiAI workflow agents for OpenCode with:

- Armi as the single user-facing entry point
- company-style delegation across PO, architect, story sharding, scrum, frontend, backend, TDD, review, QA, bugfix, release, docs, security, DB, and DevOps agents
- commands, skills, tools, plugins/hooks, and global instructions
- low-token checkpoint/resume support
- migration helper for repos already created with older agents
- installable CLI so you do not need to manually copy `.opencode` into every project

## Install globally

From this extracted folder:

```bash
npm install -g .
```

Or:

```bash
./install.sh
```

Windows PowerShell:

```powershell
.\install.ps1
```

## Use in any project

Go to your project root:

```bash
cd /path/to/your-project
armiai install
armiai migrate
armiai status
```

`armiai install` creates a `.opencode` symlink to the globally installed template. It does **not** copy the full folder into the project.

If symlink is blocked by your OS:

```bash
armiai install --copy
```

If your project already has `.opencode` and you want to replace it safely:

```bash
armiai install --force
```

The old `.opencode` will be backed up as `.opencode.backup-...`.

## Continue an old repo

For a repo that already has 5/20 stories completed:

```bash
armiai install
armiai migrate
armiai resume-plan
```

Then prompt OpenCode:

```text
Armi, continue this project from the current checkpoint. Do not redo completed stories.
```

## Useful commands

```bash
armiai doctor       # check installation and project state
armiai status       # read docs/flow-state/flow-state.json
armiai resume-plan  # print the next suggested resume action
armiai migrate      # scan existing docs and create low-token checkpoint state
armiai update       # recreate project symlink to latest installed template
armiai uninstall    # remove project symlink
armiai where        # show global template path
```

## Where continuity lives

Project-specific state is written to:

```text
docs/flow-state/flow-state.json
docs/flow-state/story-state/STORY-xxx.json
docs/flow-state/MIGRATION-REPORT.md
```

These files are intentionally small. They store status, artifact paths, and next actions, not full prompts or full agent responses.

## Design rule

The user should talk to Armi. Armi handles routing and delegation.

Examples:

```text
Armi, build this feature using the full ArmiAI workflow.
```

```text
Armi, frontend result is ugly. Improve STORY-003 and run frontend review.
```

```text
Armi, migrate this repo and continue from the next unfinished story.
```
