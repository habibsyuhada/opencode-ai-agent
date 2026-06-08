import { z } from 'zod';

export const workspaceConfigSchema = z.object({
  model: z.string().optional(),
  small_model: z.string().optional(),
  provider: z.record(z.any()).optional(),
});

export type WorkspaceConfigInput = z.infer<typeof workspaceConfigSchema>;
