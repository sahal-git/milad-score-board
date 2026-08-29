import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Trophy, Users, List, Activity, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({ totalTeams: 0, totalItems: 0, totalResults: 0, institutionName: '', institutionCode: '' });
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-wider">{stats.institutionName}</h2>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        </div>
        {stats.institutionCode && (
          <a 
            href={`/public/${stats.institutionCode}`} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-100 transition-colors"
          >
            <span>View Public Page</span>
            <ExternalLink size={18} />
          </a>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Teams" value={stats.totalTeams} icon={Users} color="bg-blue-500" />
        <StatCard title="Total Events" value={stats.totalItems} icon={Activity} color="bg-green-500" />
        <StatCard title="Total Results" value={stats.totalResults} icon={List} color="bg-purple-500" />
        <StatCard title="Leading Team" value={topTeam} icon={Trophy} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        
        {/* Overall Leaderboard */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden lg:col-span-1">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="font-semibold text-slate-800">Overall Top Teams</h2>
            <Link to="/leaderboard" className="text-sm text-indigo-600 font-medium hover:underline">View All</Link>
          </div>
          <div className="p-0">
            {top3.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No teams yet</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {top3.map((team, idx) => (
                  <div key={team.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        idx === 0 ? 'bg-amber-100 text-amber-700' :
                        idx === 1 ? 'bg-slate-200 text-slate-700' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="font-semibold text-slate-700">{team.name}</span>
                    </div>
                    <span className="font-bold text-lg">{team.totalPoints} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden lg:col-span-1">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="font-semibold text-slate-800">Categories</h2>
          </div>
          <div className="p-0 divide-y divide-slate-100">
            {categories.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No categories</p>
            ) : (
              categories.map(cat => {
                const sortedByCat = [...leaderboard].sort((a, b) => (b.categoryPoints[cat.id] || 0) - (a.categoryPoints[cat.id] || 0));
                const catTopTeam = sortedByCat.length > 0 && (sortedByCat[0].categoryPoints[cat.id] || 0) > 0 ? sortedByCat[0] : null;
                return (
                  <div key={cat.id} className="p-4">
                    <h3 className="font-bold text-slate-800">{cat.name}</h3>
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-slate-500">Top Team:</span>
                      <span className="font-medium text-indigo-600">{catTopTeam ? `${catTopTeam.name} (${catTopTeam.categoryPoints[cat.id]} pts)` : '-'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-center p-8 space-y-4 lg:col-span-1">
          <div className="bg-indigo-50 text-indigo-600 p-4 rounded-full">
            <Trophy size={48} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Ready to score?</h2>
          <p className="text-slate-500 text-center max-w-sm">Enter results quickly during the live festival without pre-registering candidates.</p>
          <Link to="/results/add" className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors w-full md:w-auto text-center">
            Add New Result
          </Link>
        </div>
      </div>
    </div>
  );
}
