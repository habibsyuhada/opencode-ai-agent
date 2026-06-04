// Company-style OpenCode hooks inspired by ECC plugin structure.
// These hooks are intentionally conservative and safe-by-default.

export default async function companyHooks() {
  return {
    async 'tool.execute.before'(input: any) {
      const text = JSON.stringify(input || {})
      const risky = [/rm\s+-rf/i, /git\s+reset\s+--hard/i, /git\s+push/i, /\.env/i]
      const hits = risky.filter((pattern) => pattern.test(text)).map(String)
      if (hits.length > 0) {
        return {
          ok: false,
          message: `Blocked risky operation or possible secret-sensitive access: ${hits.join(', ')}`
        }
      }
      return { ok: true }
    },

    async 'tool.execute.after'(input: any, result: any) {
      return { ok: true, checked: true }
    },

    async 'file.edited'(event: any) {
      const path = event?.path || ''
      const warnings = []
      if (/\.(ts|tsx|js|jsx)$/.test(path)) {
        warnings.push('Consider running lint/typecheck after editing JS/TS files.')
      }
      if (/frontend|component|page|view|ui/i.test(path)) {
        warnings.push('Frontend file edited: route to frontend-reviewer before QA.')
      }
      return { ok: true, warnings }
    }
  }
}

// Continuity note: hooks should never store full prompt/response bodies.
// For resumability, write only compact stage metadata to docs/flow-state/ via checkpoint tools.

