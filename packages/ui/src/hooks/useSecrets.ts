/**
 * TanStack Query hooks for Secret data.
 *
 * Connects to the Hono REST API to fetch, create, and delete secrets.
 * Uses the Hono client from @/lib/api for API calls.
 *
 * SECURITY: The UI NEVER receives decrypted secret values.
 * Only masked representations (e.g., "sk-...aB3x") are returned from the API.
 *
 * Server endpoints:
 * - GET    /api/secrets?scope=GLOBAL|AGENT  — List secrets (masked values)
 * - POST   /api/secrets                     — Create secret { name, value, scope }
 * - DELETE /api/secrets/:id                 — Delete a secret
 *
 * Architecture reference: docs/architecture/architecture.md §5
 * PRD reference: docs/prd/prd.md §11 (NFR-004)
 * Story: STORY-017 — Dashboard UI: Secret Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Valid scopes for secrets */
export type SecretScope = 'GLOBAL' | 'AGENT';

/** Secret type returned from the API (with masked value) */
export interface Secret {
  id: string;
  name: string;
  maskedValue: string;
  scope: SecretScope;
}

/** Input type for creating a new secret */
export interface CreateSecretInput {
  name: string;
  value: string;
  scope?: SecretScope;
}

/**
 * Fetch all secrets, optionally filtered by scope.
 *
 * Returns masked values only — the UI never receives the plaintext secret.
 *
 * @param filters - Optional scope filter ('GLOBAL' or 'AGENT')
 */
export function useSecrets(filters?: { scope?: SecretScope }) {
  return useQuery<Secret[]>({
    queryKey: ['secrets', filters],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (filters?.scope) query.scope = filters.scope;

      const res = await api.api.secrets.$get({ query });
      if (!res.ok) throw new Error('Failed to fetch secrets');
      const json = await res.json();
      return (json as { data: Secret[] }).data;
    },
  });
}

/**
 * Create a new secret.
 *
 * The plaintext value is sent to the server, which encrypts it before storage.
 * The server returns a masked representation — the plaintext is never stored
 * or returned in the clear.
 *
 * @returns Mutation object with createSecret.mutate(input)
 */
export function useCreateSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSecretInput) => {
      const res = await api.api.secrets.$post({ json: input });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const errorMessage =
          (errorBody as { error?: string })?.error || 'Failed to create secret';
        throw new Error(errorMessage);
      }
      const json = await res.json();
      return (json as { data: Secret }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets'] });
    },
  });
}

/**
 * Delete a secret by ID.
 *
 * @returns Mutation object with deleteSecret.mutate(id)
 */
export function useDeleteSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.secrets[':id'].$delete({ param: { id } });
      if (!res.ok) throw new Error('Failed to delete secret');
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets'] });
    },
  });
}
