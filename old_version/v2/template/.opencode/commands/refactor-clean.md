---
description: Remove dead code or clean structure without behavior change.
agent: refactor-cleaner
---

# /refactor-clean

Remove dead code or clean structure without behavior change.

Instructions:
- Use the `refactor-cleaner` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
