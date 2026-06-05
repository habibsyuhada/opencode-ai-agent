/**
 * Tests for the Secrets service — encryption/decryption, CRUD, masking.
 *
 * These tests mock Prisma to verify the service logic without a real database.
 * Focus areas:
 * - AES-256-GCM encryption round-trip
 * - Value masking for API responses
 * - Secret CRUD with company isolation
 * - Duplicate name prevention
 * - Decrypted secret loading for heartbeat injection
 *
 * Story: STORY-015 — Secrets Management
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

// ── Prisma Mock Setup ────────────────────────────────────────────

const {
  mockSecretFindFirst,
  mockSecretFindMany,
  mockSecretCreate,
  mockSecretDelete,
  mockActivityEventCreate,
  mockPrisma,
} = vi.hoisted(() => {
  const mockSecretFindFirst = vi.fn();
  const mockSecretFindMany = vi.fn();
  const mockSecretCreate = vi.fn();
  const mockSecretDelete = vi.fn();
  const mockActivityEventCreate = vi.fn();

  const mockPrisma = {
    secret: {
      findFirst: mockSecretFindFirst,
      findMany: mockSecretFindMany,
      create: mockSecretCreate,
      delete: mockSecretDelete,
    },
    activityEvent: {
      create: mockActivityEventCreate,
    },
  };

  return {
    mockSecretFindFirst,
    mockSecretFindMany,
    mockSecretCreate,
    mockSecretDelete,
    mockActivityEventCreate,
    mockPrisma,
  };
});

vi.mock('../../../db/client.js', () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../utils/activity.js', () => ({
  recordActivity: vi.fn(async () => ({ id: 'activity-event-1' })),
  ActivityActions: {
    SECRET_CREATE: 'SECRET_CREATE',
    SECRET_DELETE: 'SECRET_DELETE',
  },
}));

// ── Import after mocks ────────────────────────────────────────────

import {
  encryptValue,
  decryptValue,
  maskValue,
  createSecret,
  listSecrets,
  deleteSecret,
  loadDecryptedSecrets,
} from '../service.js';
import { recordActivity } from '../../../utils/activity.js';

// ── Test Data ─────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
const SECRET_ID = 'secret-1';
const SECRET_NAME = 'OPENAI_API_KEY';
const SECRET_VALUE = 'sk-abc123def456ghi789jkl012mno345pqr678stu901';

// ── Tests ─────────────────────────────────────────────────────────

describe('Secrets Service — Encryption', () => {
  it('should encrypt and decrypt a value round-trip', () => {
    const plaintext = 'my-super-secret-api-key';
    const encrypted = encryptValue(plaintext);

    // Encrypted should not equal plaintext
    expect(encrypted).not.toBe(plaintext);

    // Should have the format iv:authTag:ciphertext
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);

    // Each part should be hex-encoded
    for (const part of parts) {
      expect(/^[0-9a-f]+$/.test(part)).toBe(true);
    }

    // Decrypt should return original
    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for the same plaintext (random IV)', () => {
    const plaintext = 'same-value';
    const encrypted1 = encryptValue(plaintext);
    const encrypted2 = encryptValue(plaintext);

    // Different IVs → different ciphertext
    expect(encrypted1).not.toBe(encrypted2);

    // But both decrypt to the same value
    expect(decryptValue(encrypted1)).toBe(plaintext);
    expect(decryptValue(encrypted2)).toBe(plaintext);
  });

  it('should handle empty string encryption', () => {
    const encrypted = encryptValue('');
    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle long values', () => {
    const longValue = 'a'.repeat(4096);
    const encrypted = encryptValue(longValue);
    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe(longValue);
  });

  it('should handle special characters', () => {
    const specialValue = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
    const encrypted = encryptValue(specialValue);
    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe(specialValue);
  });

  it('should handle unicode characters', () => {
    const unicodeValue = '🔐🗝️🔑 secret with émojis and üñíçödé';
    const encrypted = encryptValue(unicodeValue);
    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe(unicodeValue);
  });

  it('should throw on invalid encrypted format', () => {
    expect(() => decryptValue('not-valid')).toThrow('Invalid encrypted value format');
    expect(() => decryptValue('')).toThrow('Invalid encrypted value format');
    expect(() => decryptValue('a:b')).toThrow('Invalid encrypted value format');
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = encryptValue('test-value');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    parts[2] = '0000' + parts[2].slice(4);
    const tampered = parts.join(':');

    expect(() => decryptValue(tampered)).toThrow();
  });
});

describe('Secrets Service — Masking', () => {
  it('should mask a long value showing first 4 and last 4 chars', () => {
    const masked = maskValue('sk-abc123def456ghi789');
    // 'sk-abc123def456ghi789' → first 4 = 'sk-a', last 4 = 'i789'
    expect(masked).toBe('sk-a...i789');
  });

  it('should mask a short value completely', () => {
    expect(maskValue('short')).toBe('****');
    expect(maskValue('12345678')).toBe('****');
    expect(maskValue('')).toBe('****');
  });

  it('should mask a 9-character value', () => {
    const masked = maskValue('123456789');
    expect(masked).toBe('1234...6789');
  });
});

describe('Secrets Service — CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSecret', () => {
    it('should create a new secret with encrypted value', async () => {
      // No existing secret with this name
      mockSecretFindFirst.mockResolvedValueOnce(null);
      mockSecretCreate.mockResolvedValueOnce({
        id: SECRET_ID,
        companyId: COMPANY_ID,
        name: SECRET_NAME,
        encryptedValue: 'some-encrypted-value',
        scope: 'GLOBAL',
      });

      const result = await createSecret(
        { name: SECRET_NAME, value: SECRET_VALUE, scope: 'GLOBAL' },
        COMPANY_ID
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBe(SECRET_ID);
      expect(result.data!.name).toBe(SECRET_NAME);
      expect(result.data!.scope).toBe('GLOBAL');
      // Masked value should not be the plaintext
      expect(result.data!.maskedValue).not.toBe(SECRET_VALUE);
      expect(result.data!.maskedValue).toContain('...');
    });

    it('should return DUPLICATE_NAME when secret name already exists', async () => {
      mockSecretFindFirst.mockResolvedValueOnce({
        id: 'existing-secret',
        companyId: COMPANY_ID,
        name: SECRET_NAME,
      });

      const result = await createSecret(
        { name: SECRET_NAME, value: SECRET_VALUE, scope: 'GLOBAL' },
        COMPANY_ID
      );

      expect(result.error).toBe('DUPLICATE_NAME');
      expect(result.data).toBeUndefined();
    });

    it('should encrypt the value before storing (not plaintext)', async () => {
      mockSecretFindFirst.mockResolvedValueOnce(null);
      mockSecretCreate.mockResolvedValueOnce({
        id: SECRET_ID,
        companyId: COMPANY_ID,
        name: SECRET_NAME,
        encryptedValue: 'encrypted',
        scope: 'GLOBAL',
      });

      await createSecret(
        { name: SECRET_NAME, value: SECRET_VALUE, scope: 'GLOBAL' },
        COMPANY_ID
      );

      // Verify that the encrypted value passed to Prisma is NOT the plaintext
      const createCall = mockSecretCreate.mock.calls[0][0];
      expect(createCall.data.encryptedValue).not.toBe(SECRET_VALUE);
      // Should have the iv:authTag:ciphertext format
      expect(createCall.data.encryptedValue.split(':')).toHaveLength(3);
    });

    it('should record an activity event on creation', async () => {
      mockSecretFindFirst.mockResolvedValueOnce(null);
      mockSecretCreate.mockResolvedValueOnce({
        id: SECRET_ID,
        companyId: COMPANY_ID,
        name: SECRET_NAME,
        encryptedValue: 'encrypted',
        scope: 'GLOBAL',
      });

      await createSecret(
        { name: SECRET_NAME, value: SECRET_VALUE, scope: 'GLOBAL' },
        COMPANY_ID
      );

      expect(recordActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SECRET_CREATE',
          targetType: 'SECRET',
          targetId: SECRET_ID,
        })
      );
    });
  });

  describe('listSecrets', () => {
    it('should list secrets with masked values', async () => {
      const encryptedValue = encryptValue(SECRET_VALUE);
      mockSecretFindMany.mockResolvedValueOnce([
        {
          id: SECRET_ID,
          companyId: COMPANY_ID,
          name: SECRET_NAME,
          encryptedValue,
          scope: 'GLOBAL',
        },
      ]);

      const result = await listSecrets(COMPANY_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(SECRET_ID);
      expect(result[0].name).toBe(SECRET_NAME);
      expect(result[0].scope).toBe('GLOBAL');
      // Should be masked, not plaintext
      expect(result[0].maskedValue).not.toBe(SECRET_VALUE);
      expect(result[0].maskedValue).toContain('...');
    });

    it('should filter by scope', async () => {
      mockSecretFindMany.mockResolvedValueOnce([]);

      await listSecrets(COMPANY_ID, { scope: 'AGENT' });

      expect(mockSecretFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            scope: 'AGENT',
          }),
        })
      );
    });

    it('should return empty array when no secrets exist', async () => {
      mockSecretFindMany.mockResolvedValueOnce([]);

      const result = await listSecrets(COMPANY_ID);

      expect(result).toEqual([]);
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret', async () => {
      mockSecretFindFirst.mockResolvedValueOnce({
        id: SECRET_ID,
        companyId: COMPANY_ID,
        name: SECRET_NAME,
      });
      mockSecretDelete.mockResolvedValueOnce({
        id: SECRET_ID,
      });

      const result = await deleteSecret(SECRET_ID, COMPANY_ID);

      expect(result).toBeDefined();
      expect(mockSecretDelete).toHaveBeenCalledWith({ where: { id: SECRET_ID } });
    });

    it('should return null when secret not found', async () => {
      mockSecretFindFirst.mockResolvedValueOnce(null);

      const result = await deleteSecret('nonexistent', COMPANY_ID);

      expect(result).toBeNull();
    });

    it('should record an activity event on deletion', async () => {
      mockSecretFindFirst.mockResolvedValueOnce({
        id: SECRET_ID,
        companyId: COMPANY_ID,
        name: SECRET_NAME,
      });
      mockSecretDelete.mockResolvedValueOnce({ id: SECRET_ID });

      await deleteSecret(SECRET_ID, COMPANY_ID);

      expect(recordActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SECRET_DELETE',
          targetType: 'SECRET',
          targetId: SECRET_ID,
        })
      );
    });
  });

  describe('loadDecryptedSecrets', () => {
    it('should return decrypted secrets as key-value map', async () => {
      const encryptedValue = encryptValue(SECRET_VALUE);
      mockSecretFindMany.mockResolvedValueOnce([
        {
          id: SECRET_ID,
          companyId: COMPANY_ID,
          name: SECRET_NAME,
          encryptedValue,
          scope: 'GLOBAL',
        },
      ]);

      const result = await loadDecryptedSecrets(COMPANY_ID);

      expect(result[SECRET_NAME]).toBe(SECRET_VALUE);
    });

    it('should return empty object when no secrets exist', async () => {
      mockSecretFindMany.mockResolvedValueOnce([]);

      const result = await loadDecryptedSecrets(COMPANY_ID);

      expect(result).toEqual({});
    });

    it('should skip secrets that fail to decrypt', async () => {
      mockSecretFindMany.mockResolvedValueOnce([
        {
          id: 'good-secret',
          companyId: COMPANY_ID,
          name: 'GOOD_SECRET',
          encryptedValue: encryptValue('valid-value'),
          scope: 'GLOBAL',
        },
        {
          id: 'bad-secret',
          companyId: COMPANY_ID,
          name: 'BAD_SECRET',
          encryptedValue: 'not-valid-encrypted',
          scope: 'GLOBAL',
        },
      ]);

      const result = await loadDecryptedSecrets(COMPANY_ID);

      expect(result['GOOD_SECRET']).toBe('valid-value');
      expect(result['BAD_SECRET']).toBeUndefined();
    });

    it('should filter by scope', async () => {
      mockSecretFindMany.mockResolvedValueOnce([]);

      await loadDecryptedSecrets(COMPANY_ID, 'AGENT');

      expect(mockSecretFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            scope: 'AGENT',
          }),
        })
      );
    });
  });
});

describe('Secrets Service — Schema Validation', () => {
  it('should validate createSecretSchema requires name and value', async () => {
    const { createSecretSchema } = await import('../schema.js');
    const result = createSecretSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should validate createSecretSchema with valid input', async () => {
    const { createSecretSchema } = await import('../schema.js');
    const result = createSecretSchema.safeParse({
      name: 'OPENAI_API_KEY',
      value: 'sk-abc123',
    });
    expect(result.success).toBe(true);
    // Default scope should be GLOBAL
    if (result.success) {
      expect(result.data.scope).toBe('GLOBAL');
    }
  });

  it('should reject lowercase secret names', async () => {
    const { createSecretSchema } = await import('../schema.js');
    const result = createSecretSchema.safeParse({
      name: 'openai_api_key',
      value: 'sk-abc123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject names with spaces', async () => {
    const { createSecretSchema } = await import('../schema.js');
    const result = createSecretSchema.safeParse({
      name: 'OPENAI API KEY',
      value: 'sk-abc123',
    });
    expect(result.success).toBe(false);
  });

  it('should accept names starting with letter and containing numbers/underscores', async () => {
    const { createSecretSchema } = await import('../schema.js');
    const result = createSecretSchema.safeParse({
      name: 'GITHUB_TOKEN_V2',
      value: 'ghp_abc123',
    });
    expect(result.success).toBe(true);
  });

  it('should validate listSecretsQuerySchema with scope filter', async () => {
    const { listSecretsQuerySchema } = await import('../schema.js');
    const result = listSecretsQuerySchema.safeParse({ scope: 'AGENT' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid scope values', async () => {
    const { listSecretsQuerySchema } = await import('../schema.js');
    const result = listSecretsQuerySchema.safeParse({ scope: 'INVALID' });
    expect(result.success).toBe(false);
  });
});
