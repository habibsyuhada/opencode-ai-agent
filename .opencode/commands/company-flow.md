---
description: Run the complete company-style workflow. Determine the current stage from existing docs, route to the next appropriate agent, and enforce artifact gates.
agent: armi
---

# /company-flow

Run the complete company-style workflow. Determine the current stage from existing docs, route to the next appropriate agent, and enforce artifact gates.

Instructions:
- Use the `armi` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
