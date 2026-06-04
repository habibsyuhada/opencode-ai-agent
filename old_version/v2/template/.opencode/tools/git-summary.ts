import { execSync } from 'node:child_process'

export async function gitSummary() {
  try {
    const status = execSync('git status --short', { encoding: 'utf8', stdio: 'pipe' })
    const diff = execSync('git diff --stat', { encoding: 'utf8', stdio: 'pipe' })
    return { ok: true, status, diff }
  } catch (error: any) {
    return { ok: false, error: error.stderr || error.message }
  }
}
