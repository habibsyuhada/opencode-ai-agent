---
description: Review changed code and write code review notes.
agent: code-reviewer
---

# /code-review

Review changed code and write code review notes.

Instructions:
- Use the `code-reviewer` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
