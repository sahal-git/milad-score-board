import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { Save, Loader } from 'lucide-react';

const PROGRAMME_CATEGORIES = [
  'kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'
];

const formatCategory = (str) => {
  if (!str) return '';
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function AddResult() {
  const [teams, setTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  
  const [formData, setFormData] = useState({
    programme_category: 'general',
    programme: '',
    candidate_name: '',
    team_id: '',
    scoring_category_id: '',
    position: '1',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const candidateInputRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsData, categoriesData, resultsData] = await Promise.all([
          apiClient('/teams'),
          apiClient('/categories'),
          apiClient('/results')
        ]);
        setTeams(teamsData);
        setCategories(categoriesData);
        setRecentResults(resultsData.slice(0, 10)); // Show top 10 recent
        
        if (categoriesData.length > 0) {
          setFormData(prev => ({ ...prev, scoring_category_id: categoriesData[0].id }));
        }
      } catch (err) {
        console.error('Failed to load form data', err);
        setError('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const calculatePoints = () => {
    const cat = categories.find(c => c.id === formData.scoring_category_id);
    if (!cat) return 0;
    if (formData.position === '1') return cat.first_points;
    if (formData.position === '2') return cat.second_points;
    if (formData.position === '3') return cat.third_points;
    return 0;
  };

  const currentPoints = calculatePoints();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!formData.programme.trim()) {
      setError('Programme is required');
      return;
    }
    if (!formData.team_id) {
      setError('Team is required');
      return;
    }

    setSaving(true);
    try {
      const resultData = {
        ...formData,
        programme: formData.programme.trim(),
        candidate_name: formData.candidate_name.trim(),
        position: parseInt(formData.position, 10),
        points_awarded: currentPoints
      };
      
      const newResult = await apiClient('/results', {
        method: 'POST',
        body: JSON.stringify(resultData),
      });
      
      // Update recent results
      const resTeam = teams.find(t => t.id === newResult.team_id);
      const resCat = categories.find(c => c.id === newResult.scoring_category_id);
      
      setRecentResults(prev => [{
        ...newResult,
        teams: resTeam ? { id: resTeam.id, name: resTeam.name } : null,
        scoring_categories: resCat ? { id: resCat.id, name: resCat.name } : null
      }, ...prev].slice(0, 10));

      setSuccess(`Result saved for ${resultData.programme} - ${resultData.position === 1 ? '1st' : resultData.position === 2 ? '2nd' : '3rd'} place`);
      
      // Reset logic: Keep team and score category. Reset candidate and position. Keep programme.
      setFormData(prev => ({
        ...prev,
        candidate_name: '',
        position: '1'
      }));
      
      // Focus candidate input to keep going fast
      if (candidateInputRef.current) {
        candidateInputRef.current.focus();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      // Auto clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this result?')) return;
    try {
      await apiClient(`/results/${id}`, { method: 'DELETE' });
      setRecentResults(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto text-indigo-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Add Result</h1>
        <p className="text-slate-500 mt-1">Enter results directly. Points are calculated automatically.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Programme Category</label>
            <select
              required
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.programme_category}
              onChange={e => setFormData({...formData, programme_category: e.target.value})}
            >
              {PROGRAMME_CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Programme *</label>
            <input
              type="text"
              required
              placeholder="e.g. Quran Recitation"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.programme}
              onChange={e => setFormData({...formData, programme: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Candidate Name (Optional)</label>
            <input
              type="text"
              ref={candidateInputRef}
              placeholder="e.g. Muhammad Sahal"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.candidate_name}
              onChange={e => setFormData({...formData, candidate_name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Team *</label>
            <select
              required
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.team_id}
              onChange={e => setFormData({...formData, team_id: e.target.value})}
            >
              <option value="">Select Team</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Score Category</label>
            <select
              required
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              value={formData.scoring_category_id}
              onChange={e => setFormData({...formData, scoring_category_id: e.target.value})}
            >
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
            <select
              required
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold text-indigo-700"
              value={formData.position}
              onChange={e => setFormData({...formData, position: e.target.value})}
            >
              <option value="1">1st Place</option>
              <option value="2">2nd Place</option>
              <option value="3">3rd Place</option>
            </select>
          </div>
          <div className="text-right flex flex-col justify-center h-[50px]">
            <span className="text-sm font-medium text-slate-500">Points Awarded</span>
            <div className="text-3xl font-black text-indigo-600">{currentPoints}</div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center space-x-2 disabled:opacity-70 text-lg shadow-sm hover:shadow-md"
        >
          {saving ? <Loader className="animate-spin" /> : <Save size={24} />}
          <span>Add Result</span>
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Recent Entries</h2>
        </div>
        {recentResults.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No results entered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
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
                {recentResults.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{r.programme}</div>
                      <div className="text-xs text-slate-500 uppercase">{formatCategory(r.programme_category)}</div>
                    </td>
                    <td className="p-4 text-slate-700">{r.candidate_name || '-'}</td>
                    <td className="p-4 font-medium text-slate-800">{r.teams?.name}</td>
                    <td className="p-4 text-slate-600">{r.scoring_categories?.name}</td>
                    <td className="p-4 text-center font-bold text-indigo-600">
                      {r.position === 1 ? '1st' : r.position === 2 ? '2nd' : '3rd'}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-800">{r.points_awarded}</td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => window.location.href = `/results/edit/${r.id}`} className="text-indigo-600 hover:underline text-sm font-medium">Edit</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-sm font-medium">Delete</button>
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
