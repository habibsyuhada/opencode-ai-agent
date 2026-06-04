# /checkpoint

Create or update low-token checkpoint files.

Write compact state only under `docs/flow-state/`. Do not store full prompts, full responses, or full artifact contents.

Required output:
- `docs/flow-state/flow-state.json`
- optional `docs/flow-state/story-state/STORY-xxx.json`
