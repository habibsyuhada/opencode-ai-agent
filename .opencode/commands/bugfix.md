---
description: Fix QA-reported bug only and write bugfix notes.
agent: bugfix-developer
---

# /bugfix

Fix QA-reported bug only and write bugfix notes.

Instructions:
- Use the `bugfix-developer` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
