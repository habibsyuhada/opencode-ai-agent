# /migrate-flow

Migrate an existing repo created by older company agents into the resumable workflow.

Steps:
1. Scan `docs/` artifacts.
2. Infer completed, pending, failed, and blocked stages.
3. Write `docs/flow-state/flow-state.json`.
4. Write `docs/flow-state/MIGRATION-REPORT.md`.
5. Continue from the next unfinished story only if the user asked to continue.
