/**
 * CompanySwitcher — Dropdown component for switching between companies.
 *
 * Displays the currently active company and provides a dropdown
 * to switch to another company the user has access to.
 *
 * Integrates with:
 * - useCompanies() hook for fetching accessible companies
 * - useActiveCompany() for managing active company state
 * - X-Company-Id header for server-side company scoping
 *
 * Architecture reference: docs/architecture/architecture.md §8
 *   "Layout: Persistent left sidebar for navigation,
 *    top header for company switcher and user profile"
 *
 * Story: STORY-016 — Multi-Company Support
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check, Loader2 } from 'lucide-react';
import { useCompanies, useActiveCompany, type Company } from '@/hooks/useCompanies';

interface CompanySwitcherProps {
  /** Optional className for styling */
  className?: string;
}

export function CompanySwitcher({ className = '' }: CompanySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { activeCompany, companies, isLoading, setActiveCompany } = useActiveCompany();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (company: Company) => {
    setActiveCompany(company);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
        <Loader2 size={16} className="animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!activeCompany || companies.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
        <Building2 size={16} className="text-gray-400" />
        <span className="text-sm text-gray-500">No companies</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium 
                   text-gray-700 hover:bg-gray-100 transition-colors w-full
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Switch company"
      >
        <Building2 size={16} className="text-blue-500 flex-shrink-0" />
        <span className="truncate">{activeCompany.name}</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1 w-64 rounded-lg border border-gray-200 
                     bg-white shadow-lg z-50 py-1"
          role="listbox"
          aria-label="Select a company"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Switch Company
            </p>
          </div>

          {/* Company list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelect(company)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left
                           transition-colors ${
                             company.id === activeCompany.id
                               ? 'bg-blue-50 text-blue-700'
                               : 'text-gray-700 hover:bg-gray-50'
                           }`}
                role="option"
                aria-selected={company.id === activeCompany.id}
              >
                <Building2
                  size={16}
                  className={
                    company.id === activeCompany.id
                      ? 'text-blue-500'
                      : 'text-gray-400'
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{company.name}</p>
                  <p className="text-xs text-gray-500 truncate">{company.slug}</p>
                </div>
                {company.id === activeCompany.id && (
                  <Check size={16} className="text-blue-500 flex-shrink-0" />
                )}
                {company.userRole && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      company.id === activeCompany.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {company.userRole}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanySwitcher;
