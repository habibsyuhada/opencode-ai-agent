# Merge & Close — STORY-015

**Story**: STORY-015 — Secrets Management
**Status**: Ready for merge
**Date**: 2026-06-04

## Summary

Implemented the full Secrets Management module for the ArmiAI Platform, providing encrypted at rest storage for API keys and tokens using AES-256-GCM, a CRUD API with masked responses, and scoped injection into the heartbeat execution environment.

## Key Deliverables

1. **Secrets Module** (`packages/server/src/modules/secrets/`)
   - `schema.ts` — Zod validation schemas (UPPER_SNAKE_CASE naming, scope enum)
   - `service.ts` — AES-256-GCM encryption/decryption, CRUD, masked responses, scoped injection
   - `routes.ts` — REST API (GET/POST/DELETE) at `/api/secrets`

2. **Encryption at Rest** (NFR-004)
   - AES-256-GCM with random IV per encryption
   - PBKDF2 key derivation (100K iterations, SHA-512)
   - Auth tag for tamper detection
   - Master key from `SECRETS_MASTER_KEY` env var

3. **API Security**
   - Plaintext never returned in responses (masked values only)
   - Company-scoped isolation on all queries
   - Activity audit trail (SECRET_CREATE, SECRET_DELETE)

4. **Heartbeat Integration**
   - Replaced placeholder base64 decryption with proper AES-256-GCM
   - Secrets decrypted only during active heartbeat execution
   - Graceful handling of decryption failures

## Files Changed

```
packages/server/src/modules/secrets/schema.ts          (new)
packages/server/src/modules/secrets/service.ts         (new)
packages/server/src/modules/secrets/routes.ts          (new)
packages/server/src/modules/secrets/__tests__/service.test.ts  (new)
packages/server/src/index.ts                           (modified)
packages/server/src/utils/activity.ts                  (modified)
packages/server/src/modules/heartbeat/service.ts       (modified)
packages/server/src/modules/heartbeat/__tests__/service.test.ts (modified)
```

## Test Results

- **235/235 tests pass** across 11 test files
- **32 new tests** for secrets module
- **No regressions** in existing modules

## Merge Checklist

- [x] All tests pass
- [x] No TypeScript errors
- [x] No hardcoded secrets or credentials
- [x] Company isolation enforced
- [x] Activity audit trail implemented
- [x] Documentation complete (dev notes, QA review, completion review)
- [x] Heartbeat integration verified

## Post-Merge Actions

1. Set `SECRETS_MASTER_KEY` environment variable in deployment
2. UI implementation for secret management (STORY-017)
3. Consider adding PATCH endpoint for secret value updates

## Close Notes

Story fully implemented per acceptance criteria. NFR-004 security requirement satisfied: secrets encrypted at rest with AES-256-GCM, only decrypted during active heartbeat executions, never exposed in API responses.
