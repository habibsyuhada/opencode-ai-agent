import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'

function files(dir: string) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []
}
function storyIdFromFile(f: string) {
  const m = f.match(/STORY-(\d{3})/)
  return m ? `STORY-${m[1]}` : null
}

export async function checkpointMigrate() {
  const dir = 'docs/flow-state'
  const storyDir = `${dir}/story-state`
  mkdirSync(storyDir, { recursive: true })

  const prd = existsSync('docs/prd/prd.md')
  const arch = existsSync('docs/architecture/architecture.md')
  const stories = files('docs/stories').map(storyIdFromFile).filter(Boolean) as string[]
  const devNotes = files('docs/dev-notes')
  const qaFiles = files('docs/qa')
  const releaseFiles = files('docs/release')
  const reviewFiles = files('docs/reviews')

  const stages: Record<string, any> = {}
  stages.prd = { agent: 'product-owner', status: prd ? 'DONE' : 'PENDING', required_artifacts: ['docs/prd/prd.md'], verified_artifacts: prd ? ['docs/prd/prd.md'] : [], summary: prd ? 'PRD artifact exists.' : 'PRD missing.' }
  stages.architecture = { agent: 'solution-architect', status: arch ? 'DONE' : 'PENDING', required_artifacts: ['docs/architecture/architecture.md'], verified_artifacts: arch ? ['docs/architecture/architecture.md'] : [], summary: arch ? 'Architecture artifact exists.' : 'Architecture missing.' }
  stages.story_sharding = { agent: 'story-sharding-agent', status: stories.length ? 'DONE' : 'PENDING', required_artifacts: ['docs/stories/STORY-001.md'], verified_artifacts: stories.map(s => `docs/stories/${s}.md`), summary: `${stories.length} story artifact(s) found.` }

  const storyStates: Record<string, any> = {}
  for (const sid of stories) {
    const dev = devNotes.find(f => f.includes(`DEV-NOTES-${sid}`))
    const blocker = devNotes.find(f => f.includes(`BLOCKER-${sid}`))
    const bugfix = devNotes.find(f => f.includes(`BUGFIX-NOTES-${sid}`))
    const qa = qaFiles.find(f => f.includes(`QA-REVIEW-${sid}`))
    const bug = qaFiles.find(f => f.includes(`BUG-REPORT-${sid}`))
    const release = releaseFiles.find(f => f.includes(`merge-close-${sid}`))
    const codeReview = reviewFiles.find(f => f.includes(`CODE-REVIEW-${sid}`))
    const frontendReview = reviewFiles.find(f => f.includes(`FRONTEND-REVIEW-${sid}`))
    let status = 'PENDING_DEV'
    let next_action = 'queue_or_develop_story'
    if (blocker) { status = 'BLOCKED'; next_action = 'resolve_blocker' }
    else if (release) { status = 'CLOSED'; next_action = 'none' }
    else if (bug && !bugfix) { status = 'QA_FAILED'; next_action = 'route_to_bugfix_developer' }
    else if (qa && !release) { status = 'QA_DONE'; next_action = 'route_to_release_close' }
    else if (dev && !qa) { status = 'DEV_DONE'; next_action = 'route_to_reviews_or_qa' }
    if (dev && !codeReview) next_action = 'route_to_code_reviewer_before_qa'
    // Frontend review is advisory because migration cannot always know whether frontend changed.
    storyStates[sid] = {
      story_id: sid,
      status,
      artifacts: {
        story: `docs/stories/${sid}.md`,
        dev_notes: dev ? `docs/dev-notes/${dev}` : null,
        blocker: blocker ? `docs/dev-notes/${blocker}` : null,
        bugfix_notes: bugfix ? `docs/dev-notes/${bugfix}` : null,
        qa_review: qa ? `docs/qa/${qa}` : null,
        bug_report: bug ? `docs/qa/${bug}` : null,
        code_review: codeReview ? `docs/reviews/${codeReview}` : null,
        frontend_review: frontendReview ? `docs/reviews/${frontendReview}` : null,
        release: release ? `docs/release/${release}` : null,
      },
      next_action,
      updated_at: new Date().toISOString(),
    }
    writeFileSync(`${storyDir}/${sid}.json`, JSON.stringify(storyStates[sid], null, 2) + '\n')
  }

  const nextStory = Object.values(storyStates).find((s: any) => s.status !== 'CLOSED') as any
  const state = {
    workflow_id: `migrated-${Date.now()}`,
    version: '2.0-low-token-resumable',
    migrated_from: 'artifact-scan',
    updated_at: new Date().toISOString(),
    current_stage: nextStory ? nextStory.story_id : (stories.length ? 'all_stories_closed' : 'prd'),
    stages,
    stories: storyStates,
    next_action: nextStory ? `${nextStory.story_id}: ${nextStory.next_action}` : (stories.length ? 'no_pending_story' : 'create_prd'),
  }
  writeFileSync(`${dir}/flow-state.json`, JSON.stringify(state, null, 2) + '\n')
  const report = [
    '# Flow State Migration Report',
    '',
    `Updated: ${state.updated_at}`,
    '',
    `- PRD: ${prd ? 'found' : 'missing'}`,
    `- Architecture: ${arch ? 'found' : 'missing'}`,
    `- Stories found: ${stories.length}`,
    `- Closed stories: ${Object.values(storyStates).filter((s: any) => s.status === 'CLOSED').length}`,
    `- Next action: ${state.next_action}`,
    '',
    'This report is compact by design. The actual project artifacts remain the source of truth.',
  ].join('\n') + '\n'
  writeFileSync(`${dir}/MIGRATION-REPORT.md`, report)
  return { ok: true, state_path: `${dir}/flow-state.json`, report_path: `${dir}/MIGRATION-REPORT.md`, next_action: state.next_action, stories_found: stories.length }
}
