/**
 * Company routes — Hono REST endpoints for Company CRUD.
 *
 * All routes are mounted under /api/companies.
 * Multi-tenant isolation is enforced by the company scope middleware.
 *
 * Story: STORY-016 — Multi-Company Support
 *   Added /accessible endpoint for company switching.
 *
 * Bugfix: STORY-020 — Multi-tenant isolation
 *   - GET /:id now verifies user-company membership
 *   - POST / now passes user.id to createCompany for junction record
 *   - PATCH /:id and DELETE /:id return 403 on access denied (not just 404)
 */

import { Hono } from 'hono';
import {
  createCompanySchema,
  updateCompanySchema,
  companyIdParamSchema,
} from './schema.js';
import {
  getCompanyByIdForUser,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompaniesForUser,
} from './service.js';

const companies = new Hono();

/**
 * GET /api/companies/accessible
 * List companies accessible to the authenticated user.
 *
 * Returns companies the user has membership in via the UserCompany junction table.
 * Used by the CompanySwitcher UI component for company switching.
 */
companies.get('/accessible', async (c) => {
  const user = c.get('user');
  const result = await getCompaniesForUser(user.id);
  return c.json({ data: result });
});

/**
 * GET /api/companies
 * List all companies accessible to the authenticated user.
 * Filters by user's company memberships for proper multi-tenant isolation.
 */
companies.get('/', async (c) => {
  const user = c.get('user');
  const result = await getCompaniesForUser(user.id);
  return c.json({ data: result });
});

/**
 * GET /api/companies/:id
 * Get a single company by ID.
 * Verifies user has membership in the target company.
 * Returns 403 if user lacks access, 404 if company not found.
 */
companies.get('/:id', async (c) => {
  const { id } = companyIdParamSchema.parse(c.req.param());
  const user = c.get('user');
  const company = await getCompanyByIdForUser(id, user.id);

  if (!company) {
    return c.json({ error: 'Company not found', code: 404 }, 404);
  }

  return c.json({ data: company });
});

/**
 * POST /api/companies
 * Create a new company.
 * Automatically creates a UserCompany junction record with OWNER role.
 */
companies.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const data = createCompanySchema.parse(body);
  const company = await createCompany(data, user.id);

  return c.json({ data: company }, 201);
});

/**
 * PATCH /api/companies/:id
 * Update an existing company.
 * Validates user has admin/owner access to the company via UserCompany table.
 * Returns 403 if user lacks access, 404 if company not found.
 */
companies.patch('/:id', async (c) => {
  const { id } = companyIdParamSchema.parse(c.req.param());
  const user = c.get('user');
  const body = await c.req.json();
  const data = updateCompanySchema.parse(body);

  const company = await updateCompany(id, data, user.id);

  if (!company) {
    return c.json({ error: 'Company not found', code: 404 }, 404);
  }

  return c.json({ data: company });
});

/**
 * DELETE /api/companies/:id
 * Delete a company.
 * Validates user has admin/owner access to the company via UserCompany table.
 * Returns 403 if user lacks access, 404 if company not found.
 */
companies.delete('/:id', async (c) => {
  const { id } = companyIdParamSchema.parse(c.req.param());
  const user = c.get('user');

  const result = await deleteCompany(id, user.id);

  if (!result) {
    return c.json({ error: 'Company not found', code: 404 }, 404);
  }

  return c.json({ message: 'Company deleted' });
});

export default companies;
