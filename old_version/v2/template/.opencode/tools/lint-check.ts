import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export async function lintCheck(args: { command?: string } = {}) {
  const command = args.command || (existsSync('package.json') ? 'npm run lint --if-present' : 'echo "No lint command detected"')
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' })
    return { ok: true, command, output }
  } catch (error: any) {
    return { ok: false, command, output: error.stdout || '', error: error.stderr || error.message }
  }
}
