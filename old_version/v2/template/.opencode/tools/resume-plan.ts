import { existsSync, readFileSync } from 'node:fs'

export async function resumePlan() {
  const path = 'docs/flow-state/flow-state.json'
  if (!existsSync(path)) return { ok: false, reason: 'missing_checkpoint', next: 'run checkpoint-migrate' }
  const state = JSON.parse(readFileSync(path, 'utf8'))
  const stories = state.stories || {}
  const pending = Object.values(stories).filter((s: any) => s.status !== 'CLOSED') as any[]
  if (!state.stages?.prd || state.stages.prd.status !== 'DONE') return { ok: true, next_agent: 'product-owner', next_action: 'create_prd', state_path: path }
  if (!state.stages?.architecture || state.stages.architecture.status !== 'DONE') return { ok: true, next_agent: 'solution-architect', next_action: 'create_architecture', state_path: path }
  if (!state.stages?.story_sharding || state.stages.story_sharding.status !== 'DONE') return { ok: true, next_agent: 'story-sharding-agent', next_action: 'shard_stories', state_path: path }
  if (!pending.length) return { ok: true, next_agent: null, next_action: 'workflow_complete_or_create_more_stories', state_path: path }
  const s = pending[0]
  let next_agent = 'scrum-master'
  if (s.next_action?.includes('bugfix')) next_agent = 'bugfix-developer'
  else if (s.next_action?.includes('code_reviewer')) next_agent = 'code-reviewer'
  else if (s.next_action?.includes('qa')) next_agent = 'qa-engineer'
  else if (s.next_action?.includes('release')) next_agent = 'scrum-master'
  else if (s.next_action?.includes('develop')) next_agent = 'developer'
  return { ok: true, story_id: s.story_id, status: s.status, next_agent, next_action: s.next_action, state_path: path }
}
