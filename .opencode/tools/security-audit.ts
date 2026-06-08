import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export async function securityAudit(args: { command?: string } = {}) {
  const command = args.command || (existsSync('package.json') ? 'npm audit --audit-level=moderate' : 'echo "No package audit available"')
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' })
    return { ok: true, command, output }
  } catch (error: any) {
    return { ok: false, command, output: error.stdout || '', error: error.stderr || error.message }
  }
}
