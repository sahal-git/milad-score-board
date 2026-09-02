import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Activity, Medal, Search, ListFilter, Loader, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PROGRAMME_CATEGORIES = [
  'kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'
];

const formatCategory = (str) => {
  if (!str) return '';
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function PublicPage() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [itemSearch, setItemSearch] = useState('');
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [filterCatId, setFilterCatId] = useState('all');
  const [filterProgCat, setFilterProgCat] = useState('all');
  const [filterProgramme, setFilterProgramme] = useState('all');

  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (headerRef.current && headerHeight === 0 && data) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, [data, headerHeight]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: inst, error: instErr } = await supabase
          .from('institutions')
          .select('id, name, place, public_score_enabled, logo_url, theme_color_1, theme_color_2')
          .eq('public_slug', code.toLowerCase())
          .single();

        if (instErr || !inst) throw new Error('Festival not found or not public.');
        if (!inst.public_score_enabled) throw new Error('Public leaderboard is currently disabled by the administrator.');

        const { data: catData } = await supabase
          .from('scoring_categories')
          .select('id, name')
          .eq('institution_id', inst.id)
          .order('name');

        const { data: teamsData } = await supabase.from('teams').select('id, name, logo_url').eq('institution_id', inst.id);
        
        const { data: resultsData } = await supabase
          .from('results')
          .select(`
            id, created_at, position, points_awarded, scoring_category_id, programme, programme_category, candidate_name,
            scoring_categories (id, name),
            teams (id, name, logo_url)
          `)
          .eq('institution_id', inst.id)
          .order('created_at', { ascending: false });

        const leaderboard = (teamsData || []).map(t => {
          const teamResults = (resultsData || []).filter(r => r.teams?.id === t.id);
          const teamBreakdown = teamResults.map(r => ({
            category_id: r.scoring_category_id,
            programme_category: r.programme_category || 'general',
            programme: (r.programme || '').trim(),
            points: r.points_awarded,
            position: r.position
          }));
          return {
            id: t.id,
            name: t.name,
            logo_url: t.logo_url,
            firstCount: teamResults.filter(r => r.position === 1).length,
            secondCount: teamResults.filter(r => r.position === 2).length,
            thirdCount: teamResults.filter(r => r.position === 3).length,
            totalPoints: teamResults.reduce((sum, r) => sum + r.points_awarded, 0),
            breakdown: teamBreakdown
          };
        });

        const grouped = {};
        for (const r of (resultsData || [])) {
          const itemId = r.programme + '|' + r.scoring_category_id;
          if (!grouped[itemId]) {
            grouped[itemId] = {
              id: itemId,
              created_at: r.created_at,
              item_name: r.programme,
              programme_category: r.programme_category,
              category_name: r.scoring_categories?.name,
            };
          }
          if (r.position === 1) {
            grouped[itemId].first_candidate = r.candidate_name;
            grouped[itemId].first_team = r.teams?.name;
            grouped[itemId].first_points = r.points_awarded;
          } else if (r.position === 2) {
            grouped[itemId].second_candidate = r.candidate_name;
            grouped[itemId].second_team = r.teams?.name;
            grouped[itemId].second_points = r.points_awarded;
          } else if (r.position === 3) {
            grouped[itemId].third_candidate = r.candidate_name;
            grouped[itemId].third_team = r.teams?.name;
            grouped[itemId].third_points = r.points_awarded;
          }
        }

        const sortedGrouped = Object.values(grouped).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setData({
          institutionName: inst.name,
          place: inst.place,
          logo_url: inst.logo_url,
          themeColor1: inst.theme_color_1 || '#4f46e5',
          themeColor2: inst.theme_color_2 || '#312e81',
          categories: catData || [],
          leaderboard: leaderboard.sort((a, b) => b.totalPoints - a.totalPoints),
          recentResults: sortedGrouped.slice(0, 5),
          allResults: sortedGrouped
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();

    const channel = supabase
      .channel('public-results')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [code]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="flex flex-col items-center text-indigo-600"><Loader className="w-12 h-12 animate-spin mb-4" /><h2 className="text-xl font-bold">Loading Live Results...</h2></div></div>;
  
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Unavailable</h2>
        <p className="text-slate-600 mb-6">{error}</p>
        <Link to="/" className="text-indigo-600 font-medium hover:underline">Go to Login</Link>
      </div>
    </div>
  );

  const availableProgrammes = data ? [...new Set(data.leaderboard.flatMap(t => t.breakdown.map(b => b.programme)))].filter(Boolean).sort() : [];

  const displayBoard = [...(data?.leaderboard || [])].map(team => {
    let relevantBreakdown = team.breakdown;
    if (filterCatId !== 'all') relevantBreakdown = relevantBreakdown.filter(b => b.category_id === filterCatId);
    if (filterProgCat !== 'all') relevantBreakdown = relevantBreakdown.filter(b => b.programme_category === filterProgCat);
    if (filterProgramme !== 'all') relevantBreakdown = relevantBreakdown.filter(b => b.programme === filterProgramme);
    
    return { ...team, displayTotal: relevantBreakdown.reduce((sum, b) => sum + b.points, 0) };
  }).sort((a, b) => b.displayTotal - a.displayTotal);

  const filteredItems = data.allResults.filter(r => 
    (r.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || 
    r.category_name?.toLowerCase().includes(itemSearch.toLowerCase())) &&
    (filterProgCat === 'all' || r.programme_category === filterProgCat) &&
    (filterProgramme === 'all' || r.item_name === filterProgramme)
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header ref={headerRef} className={`text-white shadow-lg fixed top-0 left-0 right-0 z-20 transition-all duration-300 ${isScrolled ? 'py-3 px-4' : 'p-6 md:p-10'}`} style={{ background: `linear-gradient(to right, ${data.themeColor1 || '#312e81'}, ${data.themeColor2 || '#4c1d95'})` }}>
        <div className={`max-w-5xl mx-auto flex justify-between items-center transition-all duration-300 ${isScrolled ? 'flex-row' : 'flex-col md:flex-row gap-6'}`}>
          <div className={`flex items-center text-left ${isScrolled ? 'gap-3' : 'flex-col md:flex-row gap-4 w-full md:w-auto text-center md:text-left'}`}>
            {data.logo_url && (
              <img src={data.logo_url} alt="Logo" className={`rounded-full border-white shadow-md bg-white object-cover transition-all duration-300 ${isScrolled ? 'w-10 h-10 border-2' : 'w-20 h-20 md:w-24 md:h-24 border-4'}`} />
            )}
            <div>
              <h2 className={`text-white/80 font-bold uppercase tracking-wider transition-all duration-300 ${isScrolled ? 'hidden' : 'text-xs md:text-sm mb-1'}`}>Live Festival Results</h2>
              <h1 className={`font-extrabold tracking-tight transition-all duration-300 ${isScrolled ? 'text-lg md:text-2xl line-clamp-1' : 'text-2xl md:text-4xl'}`}>{data.institutionName}</h1>
              {data.place && (
                 <p className={`text-white/70 font-medium transition-all duration-300 ${isScrolled ? 'hidden' : 'text-sm md:text-base mt-1'}`}>{data.place}</p>
              )}
            </div>
          </div>
          <div className={`flex items-center bg-black/20 backdrop-blur-sm rounded-full border border-white/10 transition-all duration-300 ${isScrolled ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
            <div className={`rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)] ${isScrolled ? 'w-2 h-2 mr-1.5' : 'w-2.5 h-2.5 mr-2'}`}></div>
            <span className={`font-medium text-white/90 ${isScrolled ? 'text-xs hidden sm:inline' : 'text-sm'}`}>Live Updates</span>
            {isScrolled && <span className="font-medium text-white/90 text-[10px] uppercase sm:hidden">Live</span>}
          </div>
        </div>
      </header>

      {/* Spacer to prevent content from jumping when header is fixed */}
      <div style={{ height: headerHeight > 0 ? headerHeight : 0 }} className="w-full"></div>

      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-1">
          <button onClick={() => setActiveTab('leaderboard')} className={`flex-1 px-4 py-3 font-bold text-sm md:text-base rounded-lg transition-all ${activeTab === 'leaderboard' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>🏆 Leaderboard</button>
          <button onClick={() => setActiveTab('items')} className={`flex-1 px-4 py-3 font-bold text-sm md:text-base rounded-lg transition-all ${activeTab === 'items' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>📋 Item-wise Results</button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {activeTab === 'leaderboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                  <Trophy className="text-amber-500" />
                  <span>Overall Leaderboard</span>
                </h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700 text-sm font-medium" value={filterProgCat} onChange={e => setFilterProgCat(e.target.value)}>
                    <option value="all">All Categories</option>
                    {PROGRAMME_CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
                  </select>
                  <select className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700 text-sm font-medium" value={filterProgramme} onChange={e => setFilterProgramme(e.target.value)}>
                    <option value="all">All Programmes</option>
                    {availableProgrammes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white text-slate-700 text-sm font-medium" value={filterCatId} onChange={e => setFilterCatId(e.target.value)}>
                    <option value="all">All Scoring</option>
                    {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {displayBoard.length === 0 ? <div className="p-8 text-center text-slate-500">No scores recorded yet.</div> : (
                  <div className="divide-y divide-slate-100">
                    {displayBoard.map((team, idx) => {
                      if (team.displayTotal === 0 && (filterCatId !== 'all' || filterProgCat !== 'all' || filterProgramme !== 'all')) return null;
                      return (
                      <div key={team.id} className="p-4 md:p-6 flex items-center justify-between hover:bg-slate-50 transition-all duration-300 transform hover:-translate-y-0.5">
                        <div className="flex items-center space-x-4 md:space-x-5">
                          <div className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-bold text-xl md:text-2xl shadow-sm ${
                            idx === 0 ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-white border-2 border-yellow-200' :
                            idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white border-2 border-slate-200' :
                            idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-white border-2 border-orange-200' :
                            'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {idx === 0 ? '🏆' : idx + 1}
                          </div>

                          {team.logo_url && (
                             <img src={team.logo_url} className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-slate-200 object-cover hidden sm:block" />
                          )}

                          <div>
                            <h3 className="font-bold text-lg md:text-xl text-slate-800">{team.name}</h3>
                            {filterCatId === 'all' && filterProgCat === 'all' && filterProgramme === 'all' && (
                              <div className="flex space-x-3 md:space-x-4 text-xs md:text-sm text-slate-500 mt-1">
                                <span title="1st Prizes" className="flex items-center space-x-1"><span className="text-amber-500 text-base">🥇</span> <span className="font-semibold">{team.firstCount}</span></span>
                                <span title="2nd Prizes" className="flex items-center space-x-1"><span className="text-slate-400 text-base">🥈</span> <span className="font-semibold">{team.secondCount}</span></span>
                                <span title="3rd Prizes" className="flex items-center space-x-1"><span className="text-orange-500 text-base">🥉</span> <span className="font-semibold">{team.thirdCount}</span></span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-black text-3xl md:text-4xl ${idx === 0 ? 'text-amber-500' : 'text-indigo-600'}`}>{team.displayTotal}</div>
                          <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider">Points</div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-xl p-6 text-white shadow-md relative overflow-hidden" style={{ backgroundColor: data.themeColor1 || '#4f46e5' }}>
                <div className="absolute -right-4 -top-4 opacity-10"><Trophy size={120} /></div>
                <h3 className="text-white/70 font-semibold mb-1 relative z-10">Total Entries</h3>
                <div className="text-4xl font-bold relative z-10">{data.allResults.length}</div>
              </div>

              {/* Recent Results Column */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                  <Medal className="text-slate-500" />
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
                            <div className="flex flex-col items-end space-y-1">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">{result.programme_category ? result.programme_category.replace('_', ' ') : 'General'}</span>
                              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold uppercase">{result.category_name}</span>
                            </div>
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
                  <p className="text-xs text-indigo-700 mt-1">Scores are automatically updated in real-time</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                <ListFilter className="text-slate-500" />
                <span>Item-wise Results</span>
              </h2>
              <div className="relative w-full md:w-72">
                <input 
                  type="text" 
                  placeholder="Search events..." 
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all text-sm font-medium shadow-sm"
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                />
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                No results found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map(result => (
                  <div key={result.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-5 py-4 flex flex-col space-y-2">
                      <h3 className="font-bold text-lg text-slate-800 line-clamp-1" title={result.item_name}>{result.item_name}</h3>
                      <div className="flex space-x-2">
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md font-bold uppercase tracking-wide">{result.programme_category ? result.programme_category.replace('_', ' ') : 'General'}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-bold uppercase tracking-wide">{result.category_name}</span>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      {result.first_team && (
                        <div className="flex items-center space-x-3">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm border border-amber-200 shadow-sm">1</div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 text-sm truncate">{result.first_candidate || '-'}</p>
                            <p className="text-xs font-semibold text-amber-600 truncate">{result.first_team} ({result.first_points} pts)</p>
                          </div>
                        </div>
                      )}
                      {result.second_team && (
                        <div className="flex items-center space-x-3">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200 shadow-sm">2</div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 text-sm truncate">{result.second_candidate || '-'}</p>
                            <p className="text-xs font-semibold text-slate-500 truncate">{result.second_team} ({result.second_points} pts)</p>
                          </div>
                        </div>
                      )}
                      {result.third_team && (
                        <div className="flex items-center space-x-3">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-orange-50 text-orange-700 flex items-center justify-center font-bold text-sm border border-orange-200 shadow-sm">3</div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 text-sm truncate">{result.third_candidate || '-'}</p>
                            <p className="text-xs font-semibold text-orange-600 truncate">{result.third_team} ({result.third_points} pts)</p>
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
