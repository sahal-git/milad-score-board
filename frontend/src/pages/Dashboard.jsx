import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Trophy, Users, List, Activity, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const PROGRAMME_CATEGORIES = [
  'kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'
];

const formatCategory = (str) => {
  if (!str) return '';
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function Dashboard() {
  const [stats, setStats] = useState({ totalTeams: 0, totalItems: 0, totalResults: 0, institutionName: '', institutionCode: '', programmeCategories: {} });
  const [leaderboard, setLeaderboard] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsData, lbData, catData] = await Promise.all([
          apiClient('/dashboard'),
          apiClient('/leaderboard'),
          apiClient('/categories')
        ]);
        setStats(statsData);
        setLeaderboard(lbData);
        setCategories(catData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  const topTeam = leaderboard.length > 0 ? leaderboard[0].name : '-';
  const top3 = leaderboard.slice(0, 3);

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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back, here's the current status for <span className="font-semibold text-slate-700">{stats.institutionName}</span></p>
        </div>
        {stats.institutionCode && (
          <a 
            href={`/public/${stats.institutionCode}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors border border-indigo-200"
          >
            <span>View Public Page</span>
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Teams" value={stats.totalTeams} icon={Users} color="bg-blue-500" />
        <StatCard title="Programmes" value={stats.totalItems} icon={List} color="bg-indigo-500" />
        <StatCard title="Results Entered" value={stats.totalResults} icon={Activity} color="bg-emerald-500" />
        <StatCard title="Top Team" value={topTeam} icon={Trophy} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard Summary */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Top Teams</h2>
            <Link to="/leaderboard" className="text-indigo-600 text-sm font-medium hover:underline">View Full Leaderboard</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {top3.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No scores yet.</div>
            ) : (
              top3.map((team, idx) => (
                <div key={team.id} className="p-4 px-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-slate-200 text-slate-700' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className="font-bold text-slate-800 text-lg">{team.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600">{team.totalPoints}</span>
                    <span className="text-xs text-slate-500 font-bold ml-1 uppercase">Pts</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Programme Category Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">Programmes by Category</h2>
          </div>
          <div className="p-4 space-y-4">
            {PROGRAMME_CATEGORIES.map(cat => {
              const data = stats.programmeCategories?.[cat] || { total: 0 };
              if (data.total === 0) return null;
              
              return (
                <div key={cat} className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex justify-between items-center">
                  <span className="font-semibold text-slate-700 text-sm">{formatCategory(cat)}</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-indigo-600">{data.total}</span>
                  </div>
                </div>
              );
            })}
            
            {(!stats.programmeCategories || Object.values(stats.programmeCategories).every(c => c.total === 0)) && (
              <div className="text-center text-slate-500 py-8">No programmes recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
