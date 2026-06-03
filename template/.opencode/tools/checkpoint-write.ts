import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'

type Patch = Record<string, any>

export async function checkpointWrite(patch: Patch = {}) {
  const dir = 'docs/flow-state'
  const path = `${dir}/flow-state.json`
  mkdirSync(dir, { recursive: true })
  const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
  const state = {
    workflow_id: previous.workflow_id || `flow-${Date.now()}`,
    version: '2.0-low-token-resumable',
    updated_at: new Date().toISOString(),
    ...previous,
    ...patch,
  }
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n')
  return { ok: true, path, summary: { current_stage: state.current_stage, next_action: state.next_action } }
}
