import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { InferRequestType, InferResponseType } from 'hono';

const configRoutes = api.config;

export type WorkspaceConfigResponse = InferResponseType<typeof configRoutes.$get, 200>;
export type WorkspaceConfigInput = InferRequestType<typeof configRoutes.$post>['json'];

export function useWorkspaceConfig() {
  return useQuery({
    queryKey: ['workspace-config'],
    queryFn: async () => {
      const res = await configRoutes.$get();
      if (!res.ok) throw new Error('Failed to fetch workspace config');
      return res.json();
    },
  });
}

export function useSaveWorkspaceConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WorkspaceConfigInput) => {
      const res = await configRoutes.$post({ json: data });
      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as any).error || 'Failed to save configuration');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-config'] });
    },
  });
}
