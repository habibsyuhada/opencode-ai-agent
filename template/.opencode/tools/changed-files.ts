import { execSync } from 'node:child_process'

export async function changedFiles() {
  try {
    const output = execSync('git status --short', { encoding: 'utf8', stdio: 'pipe' })
    return { ok: true, output }
  } catch (error: any) {
    return { ok: false, error: error.stderr || error.message }
  }
}
