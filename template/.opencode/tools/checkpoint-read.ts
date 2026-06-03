import { existsSync, readFileSync } from 'node:fs'

export async function checkpointRead() {
  const path = 'docs/flow-state/flow-state.json'
  if (!existsSync(path)) return { ok: true, exists: false, path, state: null }
  const state = JSON.parse(readFileSync(path, 'utf8'))
  return { ok: true, exists: true, path, state }
}
