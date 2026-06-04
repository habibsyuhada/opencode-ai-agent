---
description: Review frontend/UI output and write frontend review notes.
agent: frontend-reviewer
---

# /frontend-review

Review frontend/UI output and write frontend review notes.

Instructions:
- Use the `frontend-reviewer` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
