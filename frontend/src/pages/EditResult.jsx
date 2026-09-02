import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Save, Loader } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const PROGRAMME_CATEGORIES = [
  'kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'
];

const formatCategory = (str) => {
  if (!str) return '';
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function EditResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsData, categoriesData, resultData] = await Promise.all([
          apiClient('/teams'),
          apiClient('/categories'),
          apiClient(`/results/${id}`)
        ]);
        
        setTeams(teamsData);
        setCategories(categoriesData);
        
        setFormData({
          programme_category: resultData.programme_category || 'general',
          programme: resultData.programme || '',
          candidate_name: resultData.candidate_name || '',
          team_id: resultData.team_id || '',
          scoring_category_id: resultData.scoring_category_id || '',
          position: String(resultData.position) || '1',
        });
      } catch (err) {
        console.error('Failed to load data', err);
        setError('Failed to load result data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

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
    
    if (!formData.programme.trim()) {
      setError('Programme is required');
      return;
    }
    if (!formData.team_id && !formData.candidate_name.trim()) {
      setError('Please provide either a team or a candidate name.');
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
      
      await apiClient(`/results/${id}`, {
        method: 'PUT',
        body: JSON.stringify(resultData),
      });
      
      navigate('/');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto text-indigo-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Edit Result</h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

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
          <span>Save Changes</span>
        </button>
      </form>
    </div>
  );
}
