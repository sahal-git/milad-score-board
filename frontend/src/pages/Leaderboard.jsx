import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Trophy } from 'lucide-react';

const PROGRAMME_CATEGORIES = [
  'kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'
];

const formatCategory = (str) => {
  if (!str) return '';
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filterCatId, setFilterCatId] = useState('all');
  const [filterProgCat, setFilterProgCat] = useState('all');
  const [filterProgramme, setFilterProgramme] = useState('all');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const [lbData, catData] = await Promise.all([
          apiClient('/leaderboard'),
          apiClient('/categories')
        ]);
        setLeaderboard(lbData);
        setCategories(catData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading leaderboard...</div>;

  const availableProgrammes = [...new Set(leaderboard.flatMap(t => t.breakdown.map(b => b.programme)))].filter(Boolean).sort();

  const displayBoard = [...leaderboard].map(team => {
    let relevantBreakdown = team.breakdown || [];
    
    if (filterCatId !== 'all') {
      relevantBreakdown = relevantBreakdown.filter(b => b.category_id === filterCatId);
    }
    
    if (filterProgCat !== 'all') {
      relevantBreakdown = relevantBreakdown.filter(b => b.programme_category === filterProgCat);
    }

    if (filterProgramme !== 'all') {
      relevantBreakdown = relevantBreakdown.filter(b => b.programme === filterProgramme);
    }

    const displayTotal = relevantBreakdown.reduce((sum, b) => sum + b.points, 0);
    return { ...team, displayTotal };
  }).sort((a, b) => b.displayTotal - a.displayTotal);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Live Leaderboard</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-sm text-slate-500 font-medium hidden md:inline">Category:</span>
            <select 
              className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700 w-full"
              value={filterProgCat}
              onChange={e => setFilterProgCat(e.target.value)}
            >
              <option value="all">All Categories</option>
              {PROGRAMME_CATEGORIES.map(c => (
                <option key={c} value={c}>{formatCategory(c)}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-sm text-slate-500 font-medium hidden md:inline">Programme:</span>
            <select 
              className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700 w-full max-w-[200px]"
              value={filterProgramme}
              onChange={e => setFilterProgramme(e.target.value)}
            >
              <option value="all">All Programmes</option>
              {availableProgrammes.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-sm text-slate-500 font-medium hidden md:inline">Scoring:</span>
            <select 
              className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700 w-full"
              value={filterCatId}
              onChange={e => setFilterCatId(e.target.value)}
            >
              <option value="all">All Scoring Types</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {displayBoard.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No scores recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayBoard.map((team, idx) => {
              if (team.displayTotal === 0 && (filterCatId !== 'all' || filterProgCat !== 'all' || filterProgramme !== 'all')) return null;
              
              return (
              <div key={team.id} className="p-4 md:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4 md:space-x-6">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-lg md:text-xl ${
                    idx === 0 ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' :
                    idx === 1 ? 'bg-slate-200 text-slate-700 border-2 border-slate-300' :
                    idx === 2 ? 'bg-orange-100 text-orange-800 border-2 border-orange-300' :
                    'bg-slate-100 text-slate-500 font-medium'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg md:text-xl text-slate-800">{team.name}</h3>
                    {filterCatId === 'all' && filterProgCat === 'all' && filterProgramme === 'all' && (
                      <div className="flex space-x-3 text-sm text-slate-500 mt-1">
                        <span title="1st Prizes">🥇 {team.firstCount}</span>
                        <span title="2nd Prizes">🥈 {team.secondCount}</span>
                        <span title="3rd Prizes">🥉 {team.thirdCount}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-3xl md:text-4xl text-indigo-600">{team.displayTotal}</div>
                  <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mt-1">Points</div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
