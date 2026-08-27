import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Trash2, Edit } from 'lucide-react';

export default function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const data = await apiClient('/results');
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this result? Scores will be recalculated.')) return;
    try {
      await apiClient(`/results/${id}`, { method: 'DELETE' });
      fetchResults();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredResults = results.filter(r => 
    r.item_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Results</h1>
        <input 
          type="text" 
          placeholder="Search by item name..." 
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-sm">
                <th className="p-4">Item</th>
                <th className="p-4">1st Place</th>
                <th className="p-4">2nd Place</th>
                <th className="p-4">3rd Place</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">No results found.</td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{result.item_name}</td>
                    <td className="p-4">
                      <div className="text-sm font-medium">{result.first_candidate_name}</div>
                      <div className="text-xs text-amber-600 font-semibold">{result.first_team_name}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium">{result.second_candidate_name}</div>
                      <div className="text-xs text-slate-500 font-semibold">{result.second_team_name}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium">{result.third_candidate_name}</div>
                      <div className="text-xs text-orange-600 font-semibold">{result.third_team_name}</div>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDelete(result.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
