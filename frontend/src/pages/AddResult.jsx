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
    scoring_category_id: '',
    
    first_team_id: '',
    first_candidate_name: '',
    
    second_team_id: '',
    second_candidate_name: '',
    
    third_team_id: '',
    third_candidate_name: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const programmeInputRef = useRef(null);

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

  const getCatPoints = () => {
    const cat = categories.find(c => c.id === formData.scoring_category_id);
    if (!cat) return { first: 0, second: 0, third: 0 };
    return { first: cat.first_points, second: cat.second_points, third: cat.third_points };
  };

  const currentPoints = getCatPoints();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!formData.programme.trim()) {
      setError('Programme is required');
      return;
    }
    
    const hasFirst = formData.first_team_id || formData.first_candidate_name.trim();
    const hasSecond = formData.second_team_id || formData.second_candidate_name.trim();
    const hasThird = formData.third_team_id || formData.third_candidate_name.trim();

    if (!hasFirst && !hasSecond && !hasThird) {
      setError('Please fill in at least one position (team or candidate).');
      return;
    }

    setSaving(true);
    try {
      const submissions = [];
      const baseData = {
        programme_category: formData.programme_category,
        programme: formData.programme.trim(),
        scoring_category_id: formData.scoring_category_id,
      };

      if (hasFirst) {
        submissions.push({ ...baseData, team_id: formData.first_team_id || null, candidate_name: formData.first_candidate_name.trim(), position: 1, points_awarded: currentPoints.first });
      }
      if (hasSecond) {
        submissions.push({ ...baseData, team_id: formData.second_team_id || null, candidate_name: formData.second_candidate_name.trim(), position: 2, points_awarded: currentPoints.second });
      }
      if (hasThird) {
        submissions.push({ ...baseData, team_id: formData.third_team_id || null, candidate_name: formData.third_candidate_name.trim(), position: 3, points_awarded: currentPoints.third });
      }
      
      const newResults = [];
      for (const sub of submissions) {
         const newRes = await apiClient('/results', {
           method: 'POST',
           body: JSON.stringify(sub),
         });
         
         const resTeam = teams.find(t => t.id === newRes.team_id);
         const resCat = categories.find(c => c.id === newRes.scoring_category_id);
         newResults.push({
            ...newRes,
            teams: resTeam ? { id: resTeam.id, name: resTeam.name } : null,
            scoring_categories: resCat ? { id: resCat.id, name: resCat.name } : null
         });
      }
      
      setRecentResults(prev => [...newResults, ...prev].slice(0, 10));

      setSuccess(`Successfully saved ${submissions.length} result(s) for ${baseData.programme}`);
      
      // Reset logic: Clear candidates, teams, and programme, but keep categories so they can type the next programme instantly.
      setFormData(prev => ({
        ...prev,
        programme: '',
        first_team_id: '',
        first_candidate_name: '',
        second_team_id: '',
        second_candidate_name: '',
        third_team_id: '',
        third_candidate_name: '',
      }));
      
      if (programmeInputRef.current) {
        programmeInputRef.current.focus();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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

  const PositionInput = ({ position, label, colorClass, badgeClass, teamField, candidateField, points }) => (
    <div className={`p-4 md:p-6 rounded-xl border ${colorClass} shadow-sm space-y-4`}>
      <div className="flex justify-between items-center border-b pb-3 mb-2" style={{ borderColor: 'inherit' }}>
        <h3 className="font-bold flex items-center space-x-2">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${badgeClass}`}>{position}</span>
          <span>{label}</span>
        </h3>
        <div className="text-right">
          <span className="text-2xl font-black">{points}</span>
          <span className="text-xs font-bold uppercase ml-1 opacity-70">Pts</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Team</label>
          <select
            className="w-full border rounded-lg px-3 py-2 outline-none bg-white/80 focus:ring-2 focus:ring-indigo-500"
            style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            value={formData[teamField]}
            onChange={e => setFormData({...formData, [teamField]: e.target.value})}
          >
            <option value="">None / No Team</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Candidate (Optional)</label>
          <input
            type="text"
            placeholder="Name..."
            className="w-full border rounded-lg px-3 py-2 outline-none bg-white/80 focus:ring-2 focus:ring-indigo-500"
            style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            value={formData[candidateField]}
            onChange={e => setFormData({...formData, [candidateField]: e.target.value})}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Add Results</h1>
        <p className="text-slate-500 mt-1">Enter all positions for a programme at once.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Programme Category</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              value={formData.programme_category}
              onChange={e => setFormData({...formData, programme_category: e.target.value})}
            >
              {PROGRAMME_CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Programme Name *</label>
            <input
              type="text"
              required
              ref={programmeInputRef}
              placeholder="e.g. Quran Recitation"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              value={formData.programme}
              onChange={e => setFormData({...formData, programme: e.target.value})}
            />
          </div>
        </div>
        
        <div className="px-1">
          <label className="block text-sm font-medium text-slate-700 mb-3">Scoring Rules to Apply</label>
          <select
            className="w-full md:w-1/3 border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={formData.scoring_category_id}
            onChange={e => setFormData({...formData, scoring_category_id: e.target.value})}
          >
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>

        <div className="space-y-4">
          <PositionInput 
            position="1" label="1st Place" 
            colorClass="bg-amber-50/50 border-amber-200 text-amber-900" 
            badgeClass="bg-amber-100 border-2 border-amber-300 text-amber-800"
            teamField="first_team_id" candidateField="first_candidate_name" 
            points={currentPoints.first} 
          />
          <PositionInput 
            position="2" label="2nd Place" 
            colorClass="bg-slate-50/50 border-slate-200 text-slate-800" 
            badgeClass="bg-slate-200 border-2 border-slate-300 text-slate-700"
            teamField="second_team_id" candidateField="second_candidate_name" 
            points={currentPoints.second} 
          />
          <PositionInput 
            position="3" label="3rd Place" 
            colorClass="bg-orange-50/50 border-orange-200 text-orange-900" 
            badgeClass="bg-orange-100 border-2 border-orange-300 text-orange-800"
            teamField="third_team_id" candidateField="third_candidate_name" 
            points={currentPoints.third} 
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center space-x-2 disabled:opacity-70 text-lg shadow-sm hover:shadow-md"
        >
          {saving ? <Loader className="animate-spin" /> : <Save size={24} />}
          <span>Save All Results</span>
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
                    <td className="p-4 text-center font-bold">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm ${
                        r.position === 1 ? 'bg-amber-100 text-amber-700' : 
                        r.position === 2 ? 'bg-slate-200 text-slate-700' : 
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {r.position}
                      </span>
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
