# STORY-016 — Security: Secret Management & Injection
Status: Ready

## Requirement IDs
- NFR-004 [Security]

## Acceptance Criteria IDs
- N/A

## Business Context
Agents need API keys (like GitHub, OpenAI, etc.) to perform tasks. These must be stored securely and only exposed to the agent when absolutely necessary during execution.

## Technical Context
Implementing encrypted storage for secrets and injecting them into the OpenCode process environment safely.

## Scope
- Update `schema.prisma` with a `Secret` model storing `encryptedValue`.
- Implement a basic encryption/decryption utility in the server using a master key from environment variables.
- Update the `OpenCodeAdapter` to fetch necessary secrets for a given agent/task, decrypt them, and inject them into the `spawn` environment variables.

## Out of Scope
- UI for managing secrets (next story).
- Key rotation mechanisms.

## Files Likely Affected
- `/packages/server/prisma/schema.prisma`
- `/packages/server/src/utils/crypto.ts` (new)
- `/packages/server/src/engine/opencode.ts`

## Implementation Notes
- Use standard Node.js `crypto` module (e.g., `aes-256-gcm`).
- Ensure the master key is robust and never checked into version control.

## Test Requirements
- A secret saved to the DB is unreadable. When a heartbeat runs, the secret is decrypted and accessible within the OpenCode process environment.

## Edge Cases
- Master key missing or changed (decryption fails).

## Dependencies
- STORY-008 (OpenCode Process Adapter)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
