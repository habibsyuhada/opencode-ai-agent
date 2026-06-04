import { existsSync } from 'node:fs'

export async function verifyArtifacts(args: { paths: string[] }) {
  const results = args.paths.map((path) => ({ path, exists: existsSync(path) }))
  return { ok: results.every((r) => r.exists), results }
}
