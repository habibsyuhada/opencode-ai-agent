# /resume

Resume the ArmiAI workflow from the compact checkpoint and verified disk artifacts.

Steps:
1. Read `docs/flow-state/flow-state.json` if it exists.
2. If missing, reconstruct state from artifacts and write the checkpoint.
3. Identify the first unfinished stage/story.
4. Delegate only the next required work.
5. Update checkpoint after verifying output files.

Never replay all completed stages just to rebuild context.
