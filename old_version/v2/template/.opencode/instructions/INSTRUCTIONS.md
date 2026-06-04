# ArmiAI Instructions

This setup is a company-style multi-agent workflow inspired by ECC OpenCode structure.

## Primary principle
The user talks to `armi` only. Armi decides which specialist agent should work next.

## Artifact-first operation
Every serious task must create or update files on disk. Chat-only completion is not acceptable.

## Required workflow artifacts
- `docs/prd/prd.md`
- `docs/architecture/architecture.md`
- `docs/stories/STORY-xxx.md`
- `docs/queue/dev-queue.md`
- `docs/dev-notes/DEV-NOTES-STORY-xxx.md`
- `docs/reviews/CODE-REVIEW-STORY-xxx.md` when code changes
- `docs/reviews/FRONTEND-REVIEW-STORY-xxx.md` when UI changes
- `docs/reviews/SECURITY-REVIEW-STORY-xxx.md` when security-sensitive code changes
- `docs/qa/QA-REVIEW-STORY-xxx.md`
- `docs/release/merge-close-STORY-xxx.md`

## Safety
- No `git push`.
- No `git reset --hard`.
- No `rm -rf`.
- No external directory changes unless explicitly allowed by the user.

## Delegation contract
When delegating, Armi must include:
"Create or update the required file on disk. Do not return the document only in chat. Create parent directories if missing. After writing, verify the file exists and report the file path."

## Low-Token Continuity and Resume
- Keep continuity through files, not conversation memory.
- Use `docs/flow-state/flow-state.json` as the compact checkpoint ledger.
- Use `docs/flow-state/story-state/STORY-xxx.json` for per-story checkpoint state when useful.
- Never store full prompts, full agent responses, or long document contents in checkpoint files.
- Checkpoints must contain only: stage id, agent, status, required artifacts, verified artifact paths, short error summary, updated timestamp, and next recommended action.
- On every new request, Armi should inspect existing artifacts and checkpoint files before delegating work.
- If an artifact exists and its checkpoint says DONE, skip that stage unless the user explicitly asks to redo it.
- If checkpoint is missing, reconstruct state from existing files using `checkpoint-migrate` / artifact inspection.
- When a process is interrupted, resume from the last DONE stage and the first PENDING/FAILED/IN_PROGRESS stage.

