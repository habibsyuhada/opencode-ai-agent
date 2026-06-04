---
description: Inspect docs and summarize current workflow status and next recommended action.
agent: armi
---

# /status

Inspect docs and summarize current workflow status and next recommended action.

Instructions:
- Use the `armi` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
