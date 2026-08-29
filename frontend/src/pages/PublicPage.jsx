import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Activity, Medal, Search, ListFilter } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PublicPage() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [itemSearch, setItemSearch] = useState('');
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [filterCatId, setFilterCatId] = useState('all');

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        // 1. Get institution by code
        const { data: inst, error: instError } = await supabase
          .from('institutions')
          .select('id, name')
          .eq('public_slug', code.toLowerCase())
          .eq('status', 'active')
          .eq('public_score_enabled', true)
          .single();
          
        if (instError || !inst) {
          throw new Error('Festival not found or not public.');
        }

        // Fetch categories for filtering
        const { data: catData } = await supabase
          .from('scoring_categories')
          .select('id, name')
          .eq('institution_id', inst.id)
          .order('name');

        // 2. Get leaderboard
        const { data: lbData } = await supabase
          .from('leaderboard')
          .select('*')
          .eq('institution_id', inst.id)
          .order('total_points', { ascending: false });

        const leaderboard = (lbData || []).map(row => ({
          id: row.team_id,
          name: row.team_name,
          firstCount: Number(row.first_count),
          secondCount: Number(row.second_count),
          thirdCount: Number(row.third_count),
          totalPoints: Number(row.total_points),
          categoryPoints: row.category_points || {}
        }));

        // 3. Get all results
        const { data: resultsData } = await supabase
          .from('results')
          .select(`
            id,
            created_at,
            position,
            points_awarded,
            items (id, name),
            scoring_categories (id, name),
            candidates (id, name),
            teams (id, name)
          `)
          .eq('institution_id', inst.id)
          .order('created_at', { ascending: false });

        const grouped = {};
        for (const r of (resultsData || [])) {
          const itemId = r.items.id;
          if (!grouped[itemId]) {
            grouped[itemId] = {
              id: itemId,
              created_at: r.created_at,
              item_id: r.items.id,
              item_name: r.items.name,
              category_id: r.scoring_categories.id,
              category_name: r.scoring_categories.name,
            };
          }
          
          if (r.position === 1) {
            grouped[itemId].first_candidate = r.candidates?.name;
            grouped[itemId].first_team = r.teams?.name;
            grouped[itemId].first_points = r.points_awarded;
          } else if (r.position === 2) {
            grouped[itemId].second_candidate = r.candidates?.name;
            grouped[itemId].second_team = r.teams?.name;
            grouped[itemId].second_points = r.points_awarded;
          } else if (r.position === 3) {
            grouped[itemId].third_candidate = r.candidates?.name;
            grouped[itemId].third_team = r.teams?.name;
            grouped[itemId].third_points = r.points_awarded;
          }
        }

        const allResults = Object.values(grouped).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setData({
          institutionName: inst.name,
          categories: catData || [],
          leaderboard,
          allResults,
          recentResults: allResults.slice(0, 5)
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPublicData();

    const channel = supabase
      .channel('public-results')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, () => {
         fetchPublicData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scoring_categories' }, () => {
         fetchPublicData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading live data...</div>;
  
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md text-center">
        <div className="text-red-500 mb-4 flex justify-center"><Activity size={48} /></div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Unavailable</h1>
        <p className="text-slate-600 mb-6">{error}</p>
        <Link to="/" className="text-indigo-600 font-medium hover:underline">Go to Login</Link>
      </div>
    </div>
  );

  const filteredItems = data.allResults.filter(r => 
    r.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || 
    r.category_name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const displayBoard = [...data.leaderboard].map(team => {
    let displayTotal = 0;
    if (filterCatId === 'all') {
      displayTotal = team.totalPoints;
    } else {
      displayTotal = team.categoryPoints[filterCatId] || 0;
    }
    return { ...team, displayTotal };
  }).sort((a, b) => b.displayTotal - a.displayTotal);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-indigo-900 text-white p-6 shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-indigo-300 text-sm font-bold uppercase tracking-wider">Live Results</h2>
            <h1 className="text-3xl font-bold">{data.institutionName} Milaad Fest</h1>
          </div>
          <div className="flex items-center space-x-2 bg-indigo-800 px-4 py-2 rounded-full border border-indigo-700">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-sm font-medium text-indigo-100">Live Updates</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex space-x-2 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'leaderboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Leaderboard
          </button>
          <button 
            onClick={() => setActiveTab('items')}
            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'items' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Item-wise Results
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        
        {activeTab === 'leaderboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                  <Trophy className="text-amber-500" />
                  <span>Overall Leaderboard</span>
                </h2>
                <select 
                  className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700 text-sm font-medium"
                  value={filterCatId}
                  onChange={e => setFilterCatId(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {data.categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {displayBoard.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No scores recorded yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {displayBoard.map((team, idx) => {
                      if (team.displayTotal === 0 && filterCatId !== 'all') return null;
                      return (
                      <div key={team.id} className="p-4 md:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-4 md:space-x-6">
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                            idx === 0 ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' :
                            idx === 1 ? 'bg-slate-200 text-slate-700 border-2 border-slate-300' :
                            idx === 2 ? 'bg-orange-100 text-orange-800 border-2 border-orange-300' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-slate-800">{team.name}</h3>
                            {filterCatId === 'all' && (
                              <div className="flex space-x-3 text-sm text-slate-500 mt-1">
                                <span title="1st Prizes">🥇 {team.firstCount}</span>
                                <span title="2nd Prizes">🥈 {team.secondCount}</span>
                                <span title="3rd Prizes">🥉 {team.thirdCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-2xl md:text-3xl text-indigo-600">{team.displayTotal}</div>
                          <div className="text-xs text-slate-500 uppercase font-bold">Points</div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Results Column */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                <Medal className="text-indigo-500" />
                <span>Recent Results</span>
              </h2>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                {data.recentResults.length === 0 ? (
                  <div className="text-center text-slate-500 py-4">No results yet.</div>
                ) : (
                  <div className="space-y-4">
                    {data.recentResults.map(result => (
                      <div key={result.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-slate-800 text-sm">{result.item_name}</h3>
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold uppercase">{result.category_name}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          <span className="font-medium text-amber-600">1st:</span> {result.first_team} ({result.first_points} pts)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <p className="text-sm font-bold text-indigo-900">Connected to Live Updates</p>
                </div>
                <p className="text-xs text-indigo-700">
                  This page updates instantly in real-time when new results are announced.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                <ListFilter className="text-indigo-500" />
                <span>Item-wise Results</span>
              </h2>
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Search by event or category..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                No items match your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredItems.map(result => (
                  <div key={result.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800">{result.item_name}</h3>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold uppercase">{result.category_name}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {result.first_team && (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">1</div>
                          <div>
                            <p className="font-semibold text-slate-800">{result.first_candidate || '-'}</p>
                            <p className="text-xs font-medium text-amber-600">{result.first_team} ({result.first_points} pts)</p>
                          </div>
                        </div>
                      )}
                      {result.second_team && (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">2</div>
                          <div>
                            <p className="font-semibold text-slate-800">{result.second_candidate || '-'}</p>
                            <p className="text-xs font-medium text-slate-500">{result.second_team} ({result.second_points} pts)</p>
                          </div>
                        </div>
                      )}
                      {result.third_team && (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-sm">3</div>
                          <div>
                            <p className="font-semibold text-slate-800">{result.third_candidate || '-'}</p>
                            <p className="text-xs font-medium text-orange-600">{result.third_team} ({result.third_points} pts)</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
