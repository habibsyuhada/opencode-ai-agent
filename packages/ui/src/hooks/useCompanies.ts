/**
 * TanStack Query hooks for Company data and multi-company switching.
 *
 * Provides hooks for:
 * - Fetching the list of companies the user can access
 * - Managing the active/selected company
 * - Sending the X-Company-Id header for company-scoped requests
 *
 * Story: STORY-016 — Multi-Company Support
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Company type matching the Prisma model */
export interface Company {
  id: string;
  name: string;
  slug: string;
  mission?: string | null;
  createdAt: string;
  updatedAt: string;
  userRole?: string; // User's role in this company (from UserCompany junction)
}

/** The key used to store the active company ID in localStorage */
const ACTIVE_COMPANY_KEY = 'armiai-active-company-id';

/**
 * Get the stored active company ID from localStorage.
 * Returns null if not set.
 */
export function getStoredActiveCompanyId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_COMPANY_KEY);
  } catch {
    return null;
  }
}

/**
 * Store the active company ID in localStorage.
 */
export function storeActiveCompanyId(companyId: string): void {
  try {
    localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
  } catch {
    // localStorage may be unavailable in some environments
  }
}

/**
 * Clear the stored active company ID from localStorage.
 */
export function clearStoredActiveCompanyId(): void {
  try {
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Fetch all companies accessible to the authenticated user.
 *
 * Uses the /api/companies/accessible endpoint which queries the
 * UserCompany junction table. Falls back to all companies in stub mode.
 */
export function useCompanies() {
  return useQuery<Company[]>({
    queryKey: ['companies', 'accessible'],
    queryFn: async () => {
      const res = await api.api.companies.accessible.$get();
      if (!res.ok) throw new Error('Failed to fetch accessible companies');
      const json = await res.json();
      return (json as { data: Company[] }).data;
    },
    staleTime: 5 * 60_000, // Companies change rarely — cache for 5 minutes
  });
}

/**
 * Get the active company from the list of accessible companies.
 *
 * Returns the company matching the stored active company ID, or the first
 * company in the list if no stored preference exists.
 *
 * @param companies - The list of accessible companies
 * @returns The active company or undefined if list is empty
 */
export function getActiveCompany(companies: Company[]): Company | undefined {
  if (companies.length === 0) return undefined;

  const storedId = getStoredActiveCompanyId();
  if (storedId) {
    const found = companies.find((c) => c.id === storedId);
    if (found) return found;
  }

  // Default to first company
  return companies[0];
}

/**
 * Hook that returns the active company and a setter to switch companies.
 *
 * Manages the active company state via localStorage and provides
 * the company ID for use in API headers.
 *
 * @returns Object with activeCompany, setActiveCompany, and companyId
 */
export function useActiveCompany() {
  const { data: companies = [], isLoading } = useCompanies();

  const activeCompany = getActiveCompany(companies);
  const companyId = activeCompany?.id ?? null;

  /**
   * Switch to a different company.
   * Stores the selection in localStorage for persistence.
   */
  const setActiveCompany = (company: Company) => {
    storeActiveCompanyId(company.id);
    // Force a re-render by invalidating the companies query
    // The active company is derived from localStorage, so we need
    // to trigger a re-computation
    window.dispatchEvent(new CustomEvent('company-changed', { detail: { companyId: company.id } }));
  };

  return {
    activeCompany,
    companyId,
    companies,
    isLoading,
    setActiveCompany,
  };
}

/**
 * Fetch a single company by ID.
 */
export function useCompany(id: string | null) {
  return useQuery<Company>({
    queryKey: ['companies', id],
    queryFn: async () => {
      if (!id) throw new Error('Company ID is required');
      const res = await api.api.companies[':id'].$get({ param: { id } });
      if (!res.ok) throw new Error('Failed to fetch company');
      const json = await res.json();
      return (json as { data: Company }).data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new company.
 */
export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; slug: string; mission?: string }) => {
      const res = await api.api.companies.$post({ json: input });
      if (!res.ok) throw new Error('Failed to create company');
      const json = await res.json();
      return (json as { data: Company }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}
