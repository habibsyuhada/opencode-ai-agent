# OpenCode Company-Style SDD Role Flow Agents

This agent pack follows the requested company-style workflow using role/title-based agents, not persona names.

## Flow

```txt
Idea
→ Product Owner: Create PRD
→ Solution Architect: Create Architecture Documents
→ PRD + Architecture Documents Ready
→ Product Owner: Shard Docs into Dev Stories
→ Scrum Master: Queue Story Files for Dev Agent
→ Developer: Review Story Context
→ Developer: Implement Code
→ Developer: Write Tests
→ Developer: Commit Code + Notes
→ Scrum Master: Review for Completion
→ Tests Passed?
   ├─ Yes → Scrum Master: Forward to QA Agent
   └─ No  → Developer: Rework + Fix
→ QA Engineer: Run Tests + Review
→ QA Passes?
   ├─ Yes → Scrum Master: Merge PR & Close
   └─ No  → QA Engineer: Write Bug Report → Developer: Fix Bugs
```

## Agents

- `flow-director`
- `product-owner`
- `solution-architect`
- `story-sharding-agent`
- `scrum-master`
- `developer`
- `qa-engineer`
- `bugfix-developer`

## Install globally

Linux/macOS/WSL:

```bash
chmod +x install-linux-macos.sh
./install-linux-macos.sh
```

Windows PowerShell:

```powershell
.\install-windows-powershell.ps1
```

## Use in any project

```bash
cd your-project
opencode
```

Start from idea:

```txt
@flow-director
Start company-style SDD flow from this idea:
[describe your project idea]
```

Manual steps:

```txt
@product-owner
Create PRD from this idea:
[describe your project idea]
```

```txt
@solution-architect
Create architecture documents from the PRD.
```

```txt
@story-sharding-agent
Shard the PRD and architecture documents into dev stories.
```

```txt
@scrum-master
Queue the next ready story for Developer.
```

```txt
@developer
Review the queued story context, implement code, write tests, and create dev notes.
```

```txt
@scrum-master
Review the story for completion.
```

```txt
@qa-engineer
Run tests and review the completed story.
```

```txt
@bugfix-developer
Fix the bugs reported by QA for the current story.
```
