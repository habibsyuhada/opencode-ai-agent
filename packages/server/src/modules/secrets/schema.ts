/**
 * Zod schemas for Secret validation.
 *
 * Mirrors the Prisma Secret model from prisma/schema.prisma.
 *
 * Architecture reference: docs/architecture/architecture.md §5
 *   Secret: Encrypted configuration. id, companyId, name, encryptedValue, scope.
 *
 * PRD reference: docs/prd/prd.md §11 (NFR-004)
 *   "Secrets (API keys) must be encrypted at rest and only injected
 *    during active heartbeat executions."
 *
 * Story: STORY-015 — Secrets Management
 */

import { z } from 'zod';

// ── Secret Schemas ───────────────────────────────────────────────

/** Valid scopes for secrets */
export const secretScopeEnum = z.enum(['GLOBAL', 'AGENT']);

/**
 * Schema for creating a new secret.
 *
 * The `value` field is the plaintext secret that will be encrypted before storage.
 * The `name` must be unique within a company (enforced by Prisma @@unique).
 */
export const createSecretSchema = z.object({
  name: z
    .string()
    .min(1, 'Secret name is required')
    .max(128, 'Secret name must be 128 characters or less')
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      'Secret name must be UPPER_SNAKE_CASE (e.g., OPENAI_API_KEY)'
    ),
  value: z
    .string()
    .min(1, 'Secret value is required')
    .max(4096, 'Secret value must be 4096 characters or less'),
  scope: secretScopeEnum.default('GLOBAL'),
});

/**
 * Schema for updating an existing secret.
 * Only the value can be updated (name and scope are immutable).
 */
export const updateSecretSchema = z.object({
  value: z
    .string()
    .min(1, 'Secret value is required')
    .max(4096, 'Secret value must be 4096 characters or less'),
});

/** Schema for secret ID parameter */
export const secretIdParamSchema = z.object({
  id: z.string().min(1, 'Secret ID is required'),
});

/**
 * Schema for listing secrets with optional filters.
 * Supports filtering by scope.
 */
export const listSecretsQuerySchema = z.object({
  scope: secretScopeEnum.optional(),
});

// ── Inferred Types ───────────────────────────────────────────────

export type CreateSecretInput = z.infer<typeof createSecretSchema>;
export type UpdateSecretInput = z.infer<typeof updateSecretSchema>;
export type SecretIdParam = z.infer<typeof secretIdParamSchema>;
export type ListSecretsQuery = z.infer<typeof listSecretsQuerySchema>;
export type SecretScope = z.infer<typeof secretScopeEnum>;
