import { existsSync, readdirSync } from 'node:fs'

export async function flowStatus() {
  const paths = [
    'docs/prd/prd.md',
    'docs/architecture/architecture.md',
    'docs/queue/dev-queue.md'
  ]
  const basics = paths.map((path) => ({ path, exists: existsSync(path) }))
  const stories = existsSync('docs/stories') ? readdirSync('docs/stories').filter((f) => f.endsWith('.md')) : []
  const qa = existsSync('docs/qa') ? readdirSync('docs/qa').filter((f) => f.endsWith('.md')) : []
  const release = existsSync('docs/release') ? readdirSync('docs/release').filter((f) => f.endsWith('.md')) : []
  return { ok: true, basics, stories, qa, release }
}
