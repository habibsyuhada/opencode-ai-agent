/**
 * Governance routes — Hono REST endpoints for Approval workflows
 * and decision tracking.
 *
 * All routes are mounted under /api/approvals.
 * Multi-tenant isolation is enforced by the company scope middleware.
 *
 * Key endpoints:
 * - GET    /api/approvals           — List approvals
 * - GET    /api/approvals/stats     — Approval statistics
 * - GET    /api/approvals/:id       — Get approval by ID
 * - POST   /api/approvals           — Create approval request
 * - POST   /api/approvals/:id/decide — Make a decision
 * - DELETE /api/approvals/:id       — Cancel pending approval
 */

import { Hono } from 'hono';
import {
  createApprovalSchema,
  decideApprovalSchema,
  approvalIdParamSchema,
  listApprovalsQuerySchema,
} from './schema.js';
import {
  listApprovals,
  getApprovalById,
  createApproval,
  decideApproval,
  deleteApproval,
  getApprovalStats,
} from './service.js';

const approvals = new Hono();

/**
 * GET /api/approvals
 * List approvals with optional filters (status, type, requestedBy, targetType).
 */
approvals.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listApprovalsQuerySchema.parse(query);

  const result = await listApprovals(companyId, filters);
  return c.json({ data: result });
});

/**
 * GET /api/approvals/stats
 * Get approval statistics for the governance dashboard.
 */
approvals.get('/stats', async (c) => {
  const companyId = c.get('companyId');

  const stats = await getApprovalStats(companyId);
  return c.json({ data: stats });
});

/**
 * GET /api/approvals/:id
 * Get a single approval by ID.
 */
approvals.get('/:id', async (c) => {
  const { id } = approvalIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const approval = await getApprovalById(id, companyId);

  if (!approval) {
    return c.json({ error: 'Approval not found', code: 404 }, 404);
  }

  return c.json({ data: approval });
});

/**
 * POST /api/approvals
 * Create a new approval request.
 */
approvals.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createApprovalSchema.parse(body);

  const approval = await createApproval(data, companyId);
  return c.json({ data: approval }, 201);
});

/**
 * POST /api/approvals/:id/decide
 * Make a decision on a pending approval request.
 */
approvals.post('/:id/decide', async (c) => {
  const { id } = approvalIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = decideApprovalSchema.parse(body);

  const result = await decideApproval(id, data, companyId);

  if (result.error === 'NOT_FOUND') {
    return c.json({ error: 'Approval not found', code: 404 }, 404);
  }

  if (result.error === 'ALREADY_DECIDED') {
    return c.json(
      { error: 'This approval has already been decided', code: 409 },
      409
    );
  }

  return c.json({ data: result.data });
});

/**
 * DELETE /api/approvals/:id
 * Cancel/delete a pending approval.
 */
approvals.delete('/:id', async (c) => {
  const { id } = approvalIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const result = await deleteApproval(id, companyId);

  if (!result) {
    return c.json({ error: 'Approval not found', code: 404 }, 404);
  }

  if ('error' in result && result.error === 'ALREADY_DECIDED') {
    return c.json(
      { error: 'Cannot delete an approval that has already been decided', code: 409 },
      409
    );
  }

  return c.json({ message: 'Approval cancelled' });
});

export default approvals;
