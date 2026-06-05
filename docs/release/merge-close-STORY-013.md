# Merge & Close — STORY-013
Status: PENDING

## Pre-Merge Checklist
- [x] Code implemented
- [x] Tests written (40 new tests)
- [x] Tests pass locally (121/121)
- [x] Dev notes created (`docs/dev-notes/DEV-NOTES-STORY-013.md`)
- [x] Completion review created (`docs/queue/completion-review-STORY-013.md`)
- [x] QA review created (`docs/qa/QA-REVIEW-STORY-013.md`)
- [ ] Scrum Master completion review passed
- [ ] QA review passed

## Files to Merge
```
packages/ui/src/hooks/useBudgets.ts          (new)
packages/ui/src/hooks/useHeartbeats.ts        (new)
packages/ui/src/pages/BudgetPage.tsx           (modified)
packages/ui/src/pages/HeartbeatsPage.tsx       (modified)
packages/ui/src/index.ts                       (modified)
packages/ui/src/test/components.test.tsx       (modified)
docs/dev-notes/DEV-NOTES-STORY-013.md         (new)
docs/queue/completion-review-STORY-013.md      (new)
docs/qa/QA-REVIEW-STORY-013.md                (new)
docs/release/merge-close-STORY-013.md          (new)
```

## Suggested Commit Message
```
feat(ui): implement Budget and Heartbeats pages for STORY-013

- BudgetPage: summary cards, per-agent spend bar chart, cost timeline
  line chart, filterable cost events table, budget settings panel
- HeartbeatsPage: live polling for running heartbeats, heartbeat detail
  panel with logs/cost breakdown, history table with search/filter
- useBudgets hook: budgets, cost events, timeline, agent spend queries
- useHeartbeats hook: heartbeats, running heartbeats polling, detail
- Added 40 tests covering hooks, utilities, and page rendering
```

## Merge Status
- [ ] Merged to main
- [ ] Story closed in backlog

## Notes
_Merge notes here_
