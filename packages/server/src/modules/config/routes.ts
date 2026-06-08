import { z } from 'zod';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { workspaceConfigSchema } from './schema.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from '../../utils/logger.js';

const configRoutes = new Hono()
  /**
   * GET /api/config
   * Reads opencode.json from the workspace root.
   */
  .get('/', async (c) => {
    try {
      const rootDir = process.cwd();
      const configPath = path.join(rootDir, 'opencode.json');
      
      const fileContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(fileContent);
      
      // We only return the specific fields the UI needs to avoid leaking other settings
      return c.json({
        model: config.model || '',
        small_model: config.small_model || '',
        provider: config.provider || {}
      }, 200);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
         return c.json({ model: '', small_model: '', provider: {} }, 200);
      }
      logger.error(`Error reading config: ${error.message}`);
      return c.json({ error: 'Failed to read configuration' }, 500);
    }
  })
  
  /**
   * POST /api/config
   * Updates opencode.json in the workspace root.
   */
  .post(
    '/',
    zValidator('json', workspaceConfigSchema),
    async (c) => {
      try {
        const input = c.req.valid('json');
        const rootDir = process.cwd();
        const configPath = path.join(rootDir, 'opencode.json');
        
        // Read existing
        let config: any = {};
        try {
          const fileContent = await fs.readFile(configPath, 'utf-8');
          config = JSON.parse(fileContent);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
        
        // Update fields
        if (input.model) config.model = input.model;
        if (input.small_model) config.small_model = input.small_model;
        if (input.provider) config.provider = input.provider;
        
        // Write back
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
        
        return c.json({ success: true, message: 'Configuration saved to opencode.json' }, 200);
      } catch (error: any) {
        logger.error(`Error saving config: ${error.message}`);
        return c.json({ error: 'Failed to save configuration' }, 500);
      }
    }
  );

export default configRoutes;
