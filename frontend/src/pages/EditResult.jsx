import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const PositionSection = ({ title, pos, color, formData, setFormData, teams, points }) => (
  <div className={`p-5 rounded-xl border ${color} space-y-4 bg-white relative`}>
    <div className="flex justify-between items-center">
      <h3 className="font-bold text-lg">{title}</h3>
      {points !== undefined && (
        <span className="bg-slate-100 px-2 py-1 rounded text-sm font-bold text-slate-700">
          {points} pts
        </span>
      )}
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Candidate Name (Optional)</label>
      <input
        type="text"
        list="candidate-suggestions"
        className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
        placeholder="e.g. Ahmed Faiz"
        value={formData[`${pos}_candidate_name`]}
        onChange={e => setFormData({...formData, [`${pos}_candidate_name`]: e.target.value})}
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Team *</label>
      <select
        required
        className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-lg bg-white"
        value={formData[`${pos}_team_id`]}
        onChange={e => setFormData({...formData, [`${pos}_team_id`]: e.target.value})}
      >
        <option value="">Select Team</option>
        {teams.map(team => (
          <option key={team.id} value={team.id}>{team.name}</option>
        ))}
      </select>
    </div>
  </div>
);

export default function EditResult() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [teams, setTeams] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [formData, setFormData] = useState({
    item_name: '',
    category_id: '',
    first_candidate_name: '',
    first_team_id: '',
    second_candidate_name: '',
    second_team_id: '',
    third_candidate_name: '',
    third_team_id: '',
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsData, candidatesData, categoriesData, resultData] = await Promise.all([
          apiClient('/teams'),
          apiClient('/candidates'),
          apiClient('/categories'),
          apiClient(`/results/${id}`)
        ]);
        setTeams(teamsData);
        setCandidates(candidatesData);
        setCategories(categoriesData);
        setFormData({
          item_name: resultData.item_name,
          category_id: resultData.category_id,
          first_candidate_name: resultData.first_candidate_name || '',
          first_team_id: resultData.first_team_id || '',
          second_candidate_name: resultData.second_candidate_name || '',
          second_team_id: resultData.second_team_id || '',
          third_candidate_name: resultData.third_candidate_name || '',
          third_team_id: resultData.third_team_id || '',
        });
      } catch (err) {
        console.error('Failed to load form data', err);
        setError('Failed to load result. It may have been deleted.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // basic validation
    const selectedTeams = [formData.first_team_id, formData.second_team_id, formData.third_team_id].filter(Boolean);
    if (new Set(selectedTeams).size !== selectedTeams.length) {
      setError('A team cannot occupy multiple positions in the same event.');
      return;
    }

    setSaving(true);
    try {
      await apiClient(`/results/${id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      navigate('/results');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === formData.category_id);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Edit Result</h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}
      
      <datalist id="candidate-suggestions">
        {candidates.map(c => <option key={c.id} value={c.name} />)}
      </datalist>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event Name</label>
            <input
              type="text"
              disabled
              className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-3 text-xl font-semibold outline-none text-slate-500"
              value={formData.item_name}
            />
            <p className="text-xs text-slate-500 mt-2">Event name cannot be changed.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scoring Category *</label>
            <select
              required
              className="w-full border border-slate-300 rounded-lg px-4 py-3 text-xl font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              value={formData.category_id}
              onChange={e => setFormData({...formData, category_id: e.target.value})}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">Determines points awarded for positions.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PositionSection 
            title="🥇 1st Place" 
            pos="first" 
            color="border-amber-300 ring-1 ring-amber-100" 
            formData={formData} 
            setFormData={setFormData} 
            teams={teams}
            points={selectedCategory?.first_points}
          />
          <PositionSection 
            title="🥈 2nd Place" 
            pos="second" 
            color="border-slate-300 ring-1 ring-slate-100" 
            formData={formData} 
            setFormData={setFormData} 
            teams={teams} 
            points={selectedCategory?.second_points}
          />
          <PositionSection 
            title="🥉 3rd Place" 
            pos="third" 
            color="border-orange-300 ring-1 ring-orange-100" 
            formData={formData} 
            setFormData={setFormData} 
            teams={teams} 
            points={selectedCategory?.third_points}
          />
        </div>

        <button 
          type="submit" 
          disabled={saving || !formData.category_id}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-70"
        >
          <Save size={24} />
          <span>{saving ? 'Saving...' : 'Update Result'}</span>
        </button>
      </form>
    </div>
  );
}
