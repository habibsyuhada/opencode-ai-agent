---
description: Run security review and write security review notes.
agent: security-reviewer
---

# /security

Run security review and write security review notes.

Instructions:
- Use the `security-reviewer` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
