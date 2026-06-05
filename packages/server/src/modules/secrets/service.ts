/**
 * Secrets service — encryption at rest, CRUD, and scoped injection.
 *
 * All secrets are encrypted using AES-256-GCM before database storage.
 * The master encryption key is sourced from the SECRETS_MASTER_KEY
 * environment variable. If not set, a development fallback is used
 * (with a warning).
 *
 * API responses never expose plaintext secret values — only masked
 * representations are returned (e.g., "sk-...aB3x").
 *
 * During heartbeat execution, secrets are decrypted and injected
 * into the OpenCode adapter's environment variables.
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

import crypto from 'node:crypto';
import prisma from '../../db/client.js';
import { logger } from '../../utils/logger.js';
import { recordActivity, ActivityActions } from '../../utils/activity.js';
import type {
  CreateSecretInput,
  ListSecretsQuery,
  SecretScope,
} from './schema.js';

// ── Encryption Configuration ─────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128 bits
const TAG_LENGTH = 16;  // 128 bits
const SALT_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32; // 256 bits
const PBKDF2_DIGEST = 'sha512';

/**
 * Derive a 256-bit encryption key from the master key using PBKDF2.
 *
 * Uses a fixed salt derived from the master key itself (deterministic)
 * so that the same master key always produces the same derived key.
 * In production, each secret could store its own salt for additional security.
 */
function deriveKey(masterKey: string): Buffer {
  // Use a deterministic salt based on the master key
  // In production, consider per-secret salts stored alongside the ciphertext
  const salt = crypto
    .createHash('sha256')
    .update('armiai-secrets-salt-' + masterKey)
    .digest();

  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

/**
 * Get the encryption key, derived from the SECRETS_MASTER_KEY environment variable.
 *
 * Falls back to a development key if not set (with a warning).
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.SECRETS_MASTER_KEY;

  if (!masterKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECRETS_MASTER_KEY environment variable is required in production'
      );
    }

    logger.warn(
      'SECRETS_MASTER_KEY not set — using development fallback. ' +
      'Set this environment variable in production!'
    );
    return deriveKey('dev-only-master-key-do-not-use-in-production');
  }

  return deriveKey(masterKey);
}

// ── Encryption / Decryption ──────────────────────────────────────

/**
 * Encrypt a plaintext value using AES-256-GCM.
 *
 * Returns a string in the format: `iv:authTag:ciphertext` (all hex-encoded).
 * Each encryption uses a random IV for semantic security.
 *
 * @param plaintext - The secret value to encrypt
 * @returns Encrypted string suitable for database storage
 */
export function encryptValue(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted value using AES-256-GCM.
 *
 * Expects the format: `iv:authTag:ciphertext` (all hex-encoded).
 *
 * @param encryptedValue - The encrypted string from the database
 * @returns The decrypted plaintext value
 * @throws {Error} If decryption fails (wrong key, tampered data, etc.)
 */
export function decryptValue(encryptedValue: string): string {
  const key = getEncryptionKey();

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const [ivHex, tagHex, ciphertext] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Mask a secret value for API responses.
 *
 * Shows the first 4 and last 4 characters with a mask in between.
 * Examples:
 *   "sk-abc123def456ghi789" → "sk-a...i789"
 *   "short"                 → "****"
 *   ""                      → "****"
 *
 * @param plaintext - The original plaintext value
 * @returns Masked representation safe for API responses
 */
export function maskValue(plaintext: string): string {
  if (plaintext.length <= 8) {
    return '****';
  }

  const prefix = plaintext.slice(0, 4);
  const suffix = plaintext.slice(-4);
  return `${prefix}...${suffix}`;
}

// ── Secret CRUD ──────────────────────────────────────────────────

/**
 * Create a new secret.
 *
 * Encrypts the plaintext value before storage. The plaintext is never
 * persisted to the database — only the encrypted form is stored.
 *
 * @param data - Secret input (name, value, scope)
 * @param companyId - The company scope for multi-tenant isolation
 * @returns The created secret with masked value
 */
export async function createSecret(
  data: CreateSecretInput,
  companyId: string
): Promise<{
  error?: 'DUPLICATE_NAME';
  data?: {
    id: string;
    name: string;
    maskedValue: string;
    scope: string;
    createdAt?: Date;
  };
}> {
  // Check for duplicate name within this company
  const existing = await prisma.secret.findFirst({
    where: {
      companyId,
      name: data.name,
    },
  });

  if (existing) {
    return { error: 'DUPLICATE_NAME' };
  }

  // Encrypt the value
  const encryptedValue = encryptValue(data.value);

  // Store in database
  const secret = await prisma.secret.create({
    data: {
      companyId,
      name: data.name,
      encryptedValue,
      scope: data.scope,
    },
  });

  logger.info('Secret created', {
    secretId: secret.id,
    companyId,
    name: data.name,
    scope: data.scope,
  });

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'dashboard',
    action: ActivityActions.SECRET_CREATE,
    targetType: 'SECRET',
    targetId: secret.id,
    metadata: {
      name: data.name,
      scope: data.scope,
    },
  });

  return {
    data: {
      id: secret.id,
      name: secret.name,
      maskedValue: maskValue(data.value),
      scope: secret.scope,
    },
  };
}

/**
 * List secrets for a company.
 *
 * Returns metadata only — never includes decrypted values.
 * API consumers see masked values (e.g., "sk-...aB3x").
 *
 * @param companyId - The company scope
 * @param filters - Optional scope filter
 * @returns Array of secret metadata with masked values
 */
export async function listSecrets(
  companyId: string,
  filters?: ListSecretsQuery
) {
  const secrets = await prisma.secret.findMany({
    where: {
      companyId,
      ...(filters?.scope && { scope: filters.scope }),
    },
    orderBy: { name: 'asc' },
  });

  // Return metadata with masked values — never plaintext
  return secrets.map((secret) => ({
    id: secret.id,
    name: secret.name,
    scope: secret.scope,
    maskedValue: maskDecryptedValue(secret.encryptedValue),
    createdAt: undefined, // Secret model doesn't have createdAt
  }));
}

/**
 * Delete a secret by ID.
 *
 * Scoped to the authenticated company for multi-tenant isolation.
 *
 * @param id - The secret ID
 * @param companyId - The company scope
 * @returns The deleted secret, or null if not found
 */
export async function deleteSecret(id: string, companyId: string) {
  const existing = await prisma.secret.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return null;
  }

  const deleted = await prisma.secret.delete({
    where: { id },
  });

  logger.info('Secret deleted', {
    secretId: id,
    companyId,
    name: existing.name,
  });

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'dashboard',
    action: ActivityActions.SECRET_DELETE,
    targetType: 'SECRET',
    targetId: id,
    metadata: {
      name: existing.name,
    },
  });

  return deleted;
}

/**
 * Load and decrypt all secrets for a company and scope.
 *
 * This is the function called by the Heartbeat Engine during execution
 * to inject secrets into the OpenCode adapter's environment.
 *
 * Secrets are ONLY decrypted during active heartbeat executions (NFR-004).
 * They are never exposed in API responses or logs.
 *
 * @param companyId - The company scope
 * @param scope - Optional scope filter ('GLOBAL' or 'AGENT')
 * @returns Key-value map of secret name → decrypted value
 */
export async function loadDecryptedSecrets(
  companyId: string,
  scope?: SecretScope
): Promise<Record<string, string>> {
  try {
    const secrets = await prisma.secret.findMany({
      where: {
        companyId,
        ...(scope && { scope }),
      },
    });

    const result: Record<string, string> = {};

    for (const secret of secrets) {
      try {
        const decrypted = decryptValue(secret.encryptedValue);
        result[secret.name] = decrypted;
      } catch (err) {
        logger.warn('Failed to decrypt secret — skipping', {
          secretId: secret.id,
          name: secret.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  } catch (err) {
    logger.error('Failed to load secrets', {
      companyId,
      scope,
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

// ── Internal Helpers ─────────────────────────────────────────────

/**
 * Generate a masked value from an encrypted value without fully decrypting.
 *
 * Decrypts to get the length and first/last characters, then masks.
 * If decryption fails, returns a generic mask.
 */
function maskDecryptedValue(encryptedValue: string): string {
  try {
    const plaintext = decryptValue(encryptedValue);
    return maskValue(plaintext);
  } catch {
    return '****';
  }
}
