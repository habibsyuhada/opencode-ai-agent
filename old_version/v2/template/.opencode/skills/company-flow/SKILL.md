# Company Flow Skill

Use this skill whenever orchestrating work through the company-style agent system.

Principles:
- Armi is the single entry point.
- User should not need to call subagents directly.
- Every stage must leave a file artifact.
- A stage is not complete until its required artifact exists on disk.
- Prefer one story at a time unless explicitly approved.

Core flow:
Idea → PRD → Architecture → Story Sharding → Queue → Planning if needed → Development → Specialist Review → Scrum Review → QA → Bugfix if needed → Release.

Gate discipline:
- No code before a story is queued.
- No story queue before PRD + architecture are Ready.
- No QA before Scrum Master forwards the story.
- No close before QA PASS.
