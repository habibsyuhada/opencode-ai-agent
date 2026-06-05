# Dev Notes

Story ID: STORY-015

## Story Context Reviewed

- **Title**: Secrets Management
- **Requirement**: NFR-004 [Security] — "Secrets (API keys) must be encrypted at rest and only injected during active heartbeat executions."
- **Scope**: Full secrets management module with AES-256-GCM encryption at rest, CRUD API with masked responses, and scoped injection into heartbeat execution environment.
- **Dependencies**: STORY-008 (OpenCode Process Adapter), existing `Secret` Prisma model from STORY-003.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `packages/server/src/modules/secrets/schema.ts` | Created | Zod schemas for secret creation, listing, and validation |
| `packages/server/src/modules/secrets/service.ts` | Created | AES-256-GCM encryption/decryption, CRUD operations, masked API responses, scoped injection |
| `packages/server/src/modules/secrets/routes.ts` | Created | Hono REST endpoints: GET /api/secrets, POST /api/secrets, DELETE /api/secrets/:id |
| `packages/server/src/modules/secrets/__tests__/service.test.ts` | Created | 32 tests covering encryption round-trip, masking, CRUD, schema validation |
| `packages/server/src/index.ts` | Modified | Registered secrets routes under /api/secrets, added to endpoints list |
| `packages/server/src/utils/activity.ts` | Modified | Added SECRET_CREATE, SECRET_DELETE activity actions and SECRET target type |
| `packages/server/src/modules/heartbeat/service.ts` | Modified | Replaced placeholder `decryptSecret`/`loadSecrets` with proper delegation to secrets service using AES-256-GCM |
| `packages/server/src/modules/heartbeat/__tests__/service.test.ts` | Modified | Updated secret loading test to match new delegation pattern |

## Implementation Summary

### Encryption (AES-256-GCM)
- Uses Node.js `crypto` module with AES-256-GCM authenticated encryption
- Master key sourced from `SECRETS_MASTER_KEY` environment variable
- Key derived using PBKDF2 (100,000 iterations, SHA-512)
- Random 128-bit IV per encryption for semantic security
- Auth tag for integrity verification
- Format: `iv:authTag:ciphertext` (all hex-encoded)
- Development fallback key with warning when env var not set

### API Security
- Plaintext values NEVER returned in API responses
- Masked representation shown (e.g., `sk-a...i789`)
- Short values (≤8 chars) fully masked as `****`
- List endpoint returns only metadata + masked values

### Scoped Injection
- `loadDecryptedSecrets()` function for heartbeat engine
- Secrets decrypted only during active execution (NFR-004)
- Failed decryption gracefully skipped with warning log
- Delegated from heartbeat service to secrets service

### CRUD Operations
- **Create**: Validates UPPER_SNAKE_CASE naming, encrypts before storage, prevents duplicate names per company
- **List**: Returns masked values, supports scope filter (GLOBAL/AGENT)
- **Delete**: Scoped to company, records activity audit event

## Tests Added or Updated

- **32 new tests** in `packages/server/src/modules/secrets/__tests__/service.test.ts`:
  - 8 encryption tests (round-trip, random IV, edge cases, tamper detection)
  - 3 masking tests
  - 8 CRUD tests (create, duplicate prevention, list, delete, activity recording)
  - 4 loadDecryptedSecrets tests (decrypt, empty, skip failures, scope filter)
  - 7 schema validation tests (required fields, naming rules, scope enum)
- **1 updated test** in heartbeat service (secret loading delegation)

## Test Commands Run

```bash
# Secrets module tests only
node node_modules/vitest/vitest.mjs run src/modules/secrets/__tests__/service.test.ts

# Full test suite
node node_modules/vitest/vitest.mjs run
```

## Test Results

- **Secrets module**: 32/32 passed
- **Full suite**: 235/235 passed (11 test files)
- **No regressions** in existing tests

## Commit Notes

Suggested commit message:
```
feat(secrets): implement AES-256-GCM encrypted secrets management

- Add secrets module with schema, service, and routes
- Encrypt secrets at rest using AES-256-GCM (Node.js crypto)
- API responses never expose plaintext (masked values only)
- Inject decrypted secrets into heartbeat execution environment
- Register /api/secrets routes (GET, POST, DELETE)
- Add SECRET_CREATE/SECRET_DELETE activity actions
- Replace placeholder decryption in heartbeat service
- Add 32 tests (encryption, masking, CRUD, schema validation)
```

## Risks / Limitations

1. **Master key management**: Currently uses `SECRETS_MASTER_KEY` env var with PBKDF2 derivation. Key rotation requires re-encrypting all secrets.
2. **No per-secret salt**: Uses deterministic salt from master key. Could be enhanced with per-secret salts stored alongside ciphertext.
3. **No secret update endpoint**: Only create and delete. Updating requires delete + recreate.
4. **No agent-level scoping**: All company secrets available to all agents. Future enhancement could add `agentId` field.
5. **Development fallback**: Dev key is logged as warning. Production deployments must set `SECRETS_MASTER_KEY`.

## Ready for Scrum Master Review?

Status: READY_FOR_SM_REVIEW
