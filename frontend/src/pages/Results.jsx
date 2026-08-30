import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Loader, Search, PlusCircle, Medal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const formatCategory = (str) => {
  if (!str) return '';
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function Results() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  
  const PROGRAMME_CATEGORIES = [
    'kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'
  ];

  const fetchResults = async () => {
    try {
      const data = await apiClient('/results');
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this result?')) return;
    try {
      await apiClient(`/results/${id}`, { method: 'DELETE' });
      fetchResults();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const filtered = results.filter(r => {
    const matchesSearch = (r.programme || '').toLowerCase().includes(search.toLowerCase()) ||
                          (r.candidate_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (r.teams?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === 'all' || r.programme_category === filterCat;
    return matchesSearch && matchesCat;
  });

  if (loading) return <div className="p-8 text-center text-slate-500"><Loader className="animate-spin mx-auto text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Results Data</h1>
        <Link to="/" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center space-x-2">
          <PlusCircle size={20} />
          <span>Add Result</span>
        </Link>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search programmes, candidates, teams..."
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-slate-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="all">All Age Groups</option>
          {PROGRAMME_CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
              <Medal size={32} />
            </div>
            <p className="text-lg font-medium text-slate-600">No results found.</p>
            {results.length === 0 && (
              <p className="text-slate-500">Go to Add Result to enter data.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-4 font-semibold">Programme</th>
                  <th className="p-4 font-semibold">Candidate</th>
                  <th className="p-4 font-semibold">Team</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold text-center">Pos</th>
                  <th className="p-4 font-semibold text-right">Pts</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{r.programme}</div>
                      <div className="text-xs text-slate-500 uppercase">{formatCategory(r.programme_category)}</div>
                    </td>
                    <td className="p-4 text-slate-700">{r.candidate_name || '-'}</td>
                    <td className="p-4 font-medium text-slate-800">{r.teams?.name}</td>
                    <td className="p-4 text-slate-600">{r.scoring_categories?.name}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        r.position === 1 ? 'bg-amber-100 text-amber-700' : 
                        r.position === 2 ? 'bg-slate-200 text-slate-700' : 
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {r.position === 1 ? '1st' : r.position === 2 ? '2nd' : '3rd'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-indigo-600 text-lg">{r.points_awarded}</td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => navigate(`/results/edit/${r.id}`)} className="text-indigo-600 hover:underline font-medium">Edit</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
