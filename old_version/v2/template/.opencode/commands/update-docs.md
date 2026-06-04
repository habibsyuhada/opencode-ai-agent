---
description: Update docs, codemaps, changelogs, and runbooks.
agent: docs-updater
---

# /update-docs

Update docs, codemaps, changelogs, and runbooks.

Instructions:
- Use the `docs-updater` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
