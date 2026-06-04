# ArmiAI — ECC-style Resumable Workflow

This package provides an ECC-inspired `.opencode` setup for a company-style software workflow.

Main idea: the user talks to **Armi** only. Armi routes work to specialist agents.

## Included layers

- `opencode.json` registry
- `instructions/` global instructions
- `prompts/agents/` specialist agents
- `commands/` slash-command templates
- `skills/` reusable standards
- `tools/` validation, migration, and checkpoint helpers
- `plugins/` guardrails/hooks

## Resume support

Resumability is handled through compact files:

```text
docs/flow-state/flow-state.json
docs/flow-state/story-state/STORY-xxx.json
docs/flow-state/MIGRATION-REPORT.md
```

The checkpoint files intentionally store only metadata, not full conversation logs.

## Migration from older agent repos

Use:

```text
Armi, migrate this existing repo state, then continue from the next unfinished story.
```

The migration helper scans existing artifacts under `docs/` and marks completed stories as done.
