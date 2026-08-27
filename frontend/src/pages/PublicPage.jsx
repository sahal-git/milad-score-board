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
          totalPoints: Number(row.total_points)
        }));

        // 3. Get all results
        const { data: resultsData } = await supabase
          .from('results')
          .select(`
            id,
            items (name),
            c1:candidates!first_candidate_id (name),
            t1:teams!first_team_id (name),
            c2:candidates!second_candidate_id (name),
            t2:teams!second_team_id (name),
            c3:candidates!third_candidate_id (name),
            t3:teams!third_team_id (name)
          `)
          .eq('institution_id', inst.id)
          .order('created_at', { ascending: false });

        const allResults = (resultsData || []).map(r => ({
          id: r.id,
          item_name: r.items?.name,
          first_candidate: r.c1?.name,
          first_team: r.t1?.name,
          second_candidate: r.c2?.name,
          second_team: r.t2?.name,
          third_candidate: r.c3?.name,
          third_team: r.t3?.name,
        }));

        setData({
          institutionName: inst.name,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_settings' }, () => {
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
    r.item_name.toLowerCase().includes(itemSearch.toLowerCase())
  );

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
            {/* Leaderboard Column */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                <Trophy className="text-amber-500" />
                <span>Overall Leaderboard</span>
              </h2>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {data.leaderboard.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No scores recorded yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.leaderboard.map((team, idx) => (
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
                            <div className="flex space-x-3 text-sm text-slate-500 mt-1">
                              <span title="1st Prizes">🥇 {team.firstCount}</span>
                              <span title="2nd Prizes">🥈 {team.secondCount}</span>
                              <span title="3rd Prizes">🥉 {team.thirdCount}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-2xl md:text-3xl text-indigo-600">{team.totalPoints}</div>
                          <div className="text-xs text-slate-500 uppercase font-bold">Points</div>
                        </div>
                      </div>
                    ))}
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
                        <h3 className="font-semibold text-slate-800 text-sm">{result.item_name}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          <span className="font-medium text-amber-600">1st:</span> {result.first_team}
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
                  placeholder="Search by item name..."
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
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                      <h3 className="font-bold text-lg text-slate-800">{result.item_name}</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">1</div>
                        <div>
                          <p className="font-semibold text-slate-800">{result.first_candidate}</p>
                          <p className="text-xs font-medium text-amber-600">{result.first_team}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">2</div>
                        <div>
                          <p className="font-semibold text-slate-800">{result.second_candidate}</p>
                          <p className="text-xs font-medium text-slate-500">{result.second_team}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-sm">3</div>
                        <div>
                          <p className="font-semibold text-slate-800">{result.third_candidate}</p>
                          <p className="text-xs font-medium text-orange-600">{result.third_team}</p>
                        </div>
                      </div>
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
