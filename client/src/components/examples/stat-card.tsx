import { StatCard } from '../stat-card';
import { Package } from 'lucide-react';

export default function StatCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      <StatCard title="Total Supplies" value={8} icon={Package} />
      <StatCard title="Low Stock" value={2} icon={Package} description="< 7 days remaining" />
      <StatCard title="Recent Activity" value="3 days" icon={Package} description="Last update" />
    </div>
  );
}
