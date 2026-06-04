---
description: Create or run E2E tests and document results.
agent: e2e-runner
---

# /e2e

Create or run E2E tests and document results.

Instructions:
- Use the `e2e-runner` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
