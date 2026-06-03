---
description: Fix build, lint, type, dependency, or failing test command errors with minimal diffs.
agent: build-error-resolver
---

# /build-fix

Fix build, lint, type, dependency, or failing test command errors with minimal diffs.

Instructions:
- Use the `build-error-resolver` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
