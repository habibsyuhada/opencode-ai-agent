import React from 'react';
import { Bell, Search } from 'lucide-react';
import { CompanySwitcher } from './CompanySwitcher';

/**
 * Header — Top navigation bar with search, company switcher, and user profile.
 *
 * Story: STORY-016 — Multi-Company Support
 *   Added CompanySwitcher for company switching capability.
 */
export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Left section: Company Switcher + Search */}
      <div className="flex items-center gap-4">
        {/* Company Switcher */}
        <CompanySwitcher />

        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 w-80">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search agents, tasks..."
            className="bg-transparent text-sm outline-none w-full placeholder-gray-400"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-gray-600" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            A
          </div>
          <span className="text-sm font-medium text-gray-700">Admin</span>
        </div>
      </div>
    </header>
  );
}
