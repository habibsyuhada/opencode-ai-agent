/**
 * Secrets routes — Hono REST endpoints for Secrets CRUD.
 *
 * All routes are mounted under /api/secrets.
 * Multi-tenant isolation is enforced by the company scope middleware.
 *
 * Key endpoints:
 * - GET    /api/secrets       — List secrets (masked values only)
 * - POST   /api/secrets       — Create a new secret (encrypts before storage)
 * - DELETE /api/secrets/:id   — Delete a secret
 *
 * SECURITY: Plaintext secret values are NEVER returned in API responses.
 * Only masked representations (e.g., "sk-...aB3x") are included.
 *
 * Architecture reference: docs/architecture/architecture.md §5
 *   "Secret: Encrypted configuration."
 *
 * PRD reference: docs/prd/prd.md §11 (NFR-004)
 *   "Secrets (API keys) must be encrypted at rest and only injected
 *    during active heartbeat executions."
 *
 * Story: STORY-015 — Secrets Management
 */

import { Hono } from 'hono';
import {
  createSecretSchema,
  secretIdParamSchema,
  listSecretsQuerySchema,
} from './schema.js';
import {
  createSecret,
  listSecrets,
  deleteSecret,
} from './service.js';

const secrets = new Hono();

/**
 * GET /api/secrets
 *
 * List secrets for the authenticated company.
 * Returns metadata only — secret values are masked (e.g., "sk-...aB3x").
 * Supports optional scope filter: ?scope=GLOBAL or ?scope=AGENT
 */
secrets.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listSecretsQuerySchema.parse(query);

  const result = await listSecrets(companyId, filters);
  return c.json({ data: result });
});

/**
 * POST /api/secrets
 *
 * Create a new secret. The plaintext value is encrypted before storage.
 * The API response includes a masked representation of the value.
 *
 * Request body:
 * - name: UPPER_SNAKE_CASE identifier (e.g., OPENAI_API_KEY)
 * - value: The plaintext secret value
 * - scope: 'GLOBAL' (default) or 'AGENT'
 *
 * Returns 409 if a secret with the same name already exists in this company.
 */
secrets.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createSecretSchema.parse(body);

  const result = await createSecret(data, companyId);

  if (result.error === 'DUPLICATE_NAME') {
    return c.json(
      {
        error: 'A secret with this name already exists in this company',
        code: 409,
      },
      409
    );
  }

  return c.json({ data: result.data }, 201);
});

/**
 * DELETE /api/secrets/:id
 *
 * Delete a secret by ID.
 * Scoped to the authenticated company for multi-tenant isolation.
 */
secrets.delete('/:id', async (c) => {
  const { id } = secretIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const result = await deleteSecret(id, companyId);

  if (!result) {
    return c.json({ error: 'Secret not found', code: 404 }, 404);
  }

  return c.json({ message: 'Secret deleted' });
});

export default secrets;
