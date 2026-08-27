import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Shield, Building2, Ban, Activity } from 'lucide-react';

export default function SuperDashboard() {
  const [stats, setStats] = useState({ totalInsts: 0, activeInsts: 0, suspInsts: 0, totalTeams: 0, totalResults: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiClient('/super/stats');
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
      <div className={`p-4 rounded-full ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold text-slate-800">Super Admin Overview</h1>
        <p className="text-slate-500">Manage all institutions across the platform.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Institutions" value={stats.totalInsts} icon={Building2} color="bg-indigo-500" />
        <StatCard title="Active Institutions" value={stats.activeInsts} icon={Activity} color="bg-green-500" />
        <StatCard title="Suspended Institutions" value={stats.suspInsts} icon={Ban} color="bg-red-500" />
        <StatCard title="Total System Teams" value={stats.totalTeams} icon={Shield} color="bg-blue-500" />
        <StatCard title="Total System Results" value={stats.totalResults} icon={Shield} color="bg-purple-500" />
      </div>
    </div>
  );
}
