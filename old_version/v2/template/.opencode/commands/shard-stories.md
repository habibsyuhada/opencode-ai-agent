---
description: Create traceable story files from Ready PRD and architecture.
agent: story-sharding-agent
---

# /shard-stories

Create traceable story files from Ready PRD and architecture.

Instructions:
- Use the `story-sharding-agent` agent.
- Create or update the required file on disk.
- Do not return the artifact only in chat.
- Create parent directories if missing.
- After writing, verify the file exists and report the path.
- Keep scope controlled and route blockers to the appropriate blocker document.

User request:
{$ARGUMENTS}
