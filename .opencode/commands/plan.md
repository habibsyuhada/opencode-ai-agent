---
description: Create an implementation plan for the queued or specified story.
agent: planner
---

# /plan

Create an implementation plan for the queued or specified story.

Instructions:
- Use the `planner` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
