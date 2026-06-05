import React from 'react';
import { Users, CheckSquare, DollarSign, Activity } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome to ArmiAI — your AI team overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Agents"
          value="—"
          icon={<Users size={24} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Open Tasks"
          value="—"
          icon={<CheckSquare size={24} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          title="Monthly Spend"
          value="—"
          icon={<DollarSign size={24} className="text-yellow-600" />}
          color="bg-yellow-50"
        />
        <StatCard
          title="Heartbeats Today"
          value="—"
          icon={<Activity size={24} className="text-purple-600" />}
          color="bg-purple-50"
        />
      </div>

      {/* Placeholder content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        <p className="mt-2 text-sm text-gray-500">
          Activity feed will appear here once agents start executing tasks.
        </p>
      </div>
    </div>
  );
}
