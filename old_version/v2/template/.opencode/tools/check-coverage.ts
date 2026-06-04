import { execSync } from 'node:child_process'

export async function checkCoverage(args: { command?: string } = {}) {
  const command = args.command || 'npm run test:coverage --if-present'
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' })
    return { ok: true, command, output }
  } catch (error: any) {
    return { ok: false, command, output: error.stdout || '', error: error.stderr || error.message }
  }
}
