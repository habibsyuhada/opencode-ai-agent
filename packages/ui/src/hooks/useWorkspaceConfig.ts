import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { InferRequestType, InferResponseType } from 'hono';
import type { AppType } from '@opencode-ai/server';

// @ts-ignore - The Hono RPC client exposes the API through a nested proxy. 
// Depending on how the server is structured (if it mounts under /api or directly),
// the proxy path changes. If it fails, it means the structure is wrong.
// Based on the api.ts documentation, it mounts as api.api... or similar.
// But we actually need to use standard fetch if type inference is broken.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type WorkspaceConfigInput = {
  model?: string;
  small_model?: string;
  provider?: Record<string, any>;
};

export function useWorkspaceConfig() {
  return useQuery({
    queryKey: ['workspace-config'],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/config`);
      if (!res.ok) throw new Error('Failed to fetch workspace config');
      return res.json();
    },
  });
}

export function useSaveWorkspaceConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WorkspaceConfigInput) => {
      const res = await fetch(`${BASE_URL}/api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save configuration');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-config'] });
    },
  });
}
