import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Trophy } from 'lucide-react';

const PROGRAMME_CATEGORIES = [
  'kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'
];

const formatCategory = (str) => {
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCatId, setFilterCatId] = useState('all');
  const [filterProgCat, setFilterProgCat] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [boardData, catData] = await Promise.all([
        apiClient('/leaderboard'),
        apiClient('/categories')
      ]);
      setLeaderboard(boardData);
      setCategories(catData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  // Derive display data based on filter
  const displayBoard = [...leaderboard].map(team => {
    let relevantBreakdown = team.breakdown;
    
    if (filterCatId !== 'all') {
      relevantBreakdown = relevantBreakdown.filter(b => b.category_id === filterCatId);
    }
    
    if (filterProgCat !== 'all') {
      relevantBreakdown = relevantBreakdown.filter(b => b.programme_category === filterProgCat);
    }

    const displayTotal = relevantBreakdown.reduce((sum, b) => sum + b.points, 0);
    return { ...team, displayTotal };
  }).sort((a, b) => b.displayTotal - a.displayTotal);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Live Leaderboard</h1>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-500 font-medium hidden md:inline">Category:</span>
            <select 
              className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700"
              value={filterProgCat}
              onChange={e => setFilterProgCat(e.target.value)}
            >
              <option value="all">All Categories</option>
              {PROGRAMME_CATEGORIES.map(c => (
                <option key={c} value={c}>{formatCategory(c)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-500 font-medium hidden md:inline">Scoring:</span>
            <select 
              className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700"
              value={filterCatId}
              onChange={e => setFilterCatId(e.target.value)}
            >
              <option value="all">All Scoring Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchData} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 text-sm">
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-sm">
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4">Team</th>
                {filterCatId === 'all' && categories.map(cat => (
                  <th key={cat.id} className="p-4 text-right text-slate-500 font-medium hidden md:table-cell">
                    {cat.name}
                  </th>
                ))}
                <th className="p-4 text-right pr-6">Total Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayBoard.length === 0 ? (
                <tr>
                  <td colSpan={3 + (filterCatId === 'all' ? categories.length : 0)} className="p-8 text-center text-slate-500">No teams found. Add teams to see the leaderboard.</td>
                </tr>
              ) : (
                displayBoard.map((team, idx) => {
                  const isFirst = idx === 0 && team.displayTotal > 0;
                  const isSecond = idx === 1 && team.displayTotal > 0;
                  const isThird = idx === 2 && team.displayTotal > 0;
                  
                  return (
                    <tr key={team.id} className={`hover:bg-slate-50 transition-colors ${isFirst ? 'bg-amber-50/30' : ''}`}>
                      <td className="p-4 text-center">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          isFirst ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' :
                          isSecond ? 'bg-slate-200 text-slate-700' :
                          isThird ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          {isFirst && <Trophy size={18} className="text-amber-500" />}
                          <span className={`font-semibold ${isFirst ? 'text-amber-900 text-lg' : 'text-slate-700'}`}>
                            {team.name}
                          </span>
                        </div>
                      </td>
                      {filterCatId === 'all' && categories.map(cat => (
                        <td key={cat.id} className="p-4 text-right text-slate-500 hidden md:table-cell">
                          {team.categoryPoints[cat.id] || 0}
                        </td>
                      ))}
                      <td className={`p-4 text-right pr-6 font-bold ${isFirst ? 'text-amber-700 text-xl' : 'text-slate-800 text-lg'}`}>
                        {team.displayTotal}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
