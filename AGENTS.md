# Company-Style SDD Role Flow

This project follows a practical company-style development workflow using role-based agents.

## Main Flow

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

- `flow-director` — Orchestrates the whole workflow.
- `product-owner` — Converts idea into PRD.
- `solution-architect` — Creates architecture documents.
- `story-sharding-agent` — Breaks PRD and architecture docs into dev stories.
- `scrum-master` — Queues stories, checks completion, controls flow gates.
- `developer` — Reviews story context, implements code, writes tests, and writes commit notes.
- `qa-engineer` — Runs tests, reviews implementation, writes bug reports.
- `bugfix-developer` — Fixes bugs reported by QA or failed tests.

## Required Folders

```txt
docs/
  prd/
  architecture/
  stories/
  queue/
  dev-notes/
  qa/
  release/
```

## Required Gates

1. PRD must exist before architecture.
2. Architecture docs must exist before story sharding.
3. Story file must be queued before development.
4. Developer must review story context before coding.
5. Developer must write tests before completion.
6. Scrum Master must review completion before QA.
7. Failed tests go back to Developer Rework.
8. Failed QA produces bug report.
9. Bug reports go back to Bugfix Developer.
10. Scrum Master merges/closes only after QA PASS.
