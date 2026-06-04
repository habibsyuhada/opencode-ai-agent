# Continuity State Skill

Purpose: keep long ArmiAI workflows resumable without wasting tokens.

State location:
- Main ledger: `docs/flow-state/flow-state.json`
- Per-story state: `docs/flow-state/story-state/STORY-xxx.json`
- Migration report: `docs/flow-state/MIGRATION-REPORT.md`

Rules:
1. Do not save full prompts, full model responses, or copied artifact content in state files.
2. Save only compact metadata:
   - `workflow_id`
   - `current_stage`
   - `stages[stage_id].status`
   - `stages[stage_id].agent`
   - `stages[stage_id].required_artifacts`
   - `stages[stage_id].verified_artifacts`
   - `stages[stage_id].summary` limited to 160 characters
   - `stages[stage_id].error` limited to 240 characters
   - `next_action`
3. The source of truth remains the actual project files, not the checkpoint summary.
4. On resume, read compact state first, then read only the specific artifact needed for the next agent.
5. If state and disk disagree, trust disk artifacts and update the checkpoint.
6. Mark a stage DONE only after the required artifact file exists on disk.
7. Mark interrupted work as `IN_PROGRESS` or `FAILED`, never DONE.
