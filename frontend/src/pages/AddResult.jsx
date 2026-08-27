import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AddResult() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [items, setItems] = useState([]);
  const [candidates, setCandidates] = useState([]);
  
  const [formData, setFormData] = useState({
    item_name: '',
    first_candidate_name: '',
    first_team_id: '',
    second_candidate_name: '',
    second_team_id: '',
    third_candidate_name: '',
    third_team_id: '',
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsData, itemsData, candidatesData] = await Promise.all([
          apiClient('/teams'),
          apiClient('/items'),
          apiClient('/candidates')
        ]);
        setTeams(teamsData);
        setItems(itemsData);
        setCandidates(candidatesData);
      } catch (err) {
        console.error('Failed to load form data', err);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    


    setSaving(true);
    try {
      await apiClient('/results', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      navigate('/results');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const PositionSection = ({ title, pos, color }) => (
    <div className={`p-5 rounded-xl border ${color} space-y-4 bg-white`}>
      <h3 className="font-bold text-lg">{title}</h3>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Candidate Name *</label>
        <input
          required
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Add Result</h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

      <datalist id="item-suggestions">
        {items.map(item => <option key={item.id} value={item.name} />)}
      </datalist>
      
      <datalist id="candidate-suggestions">
        {candidates.map(c => <option key={c.id} value={c.name} />)}
      </datalist>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
          <input
            required
            type="text"
            list="item-suggestions"
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-xl font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g. Quran Quiz"
            value={formData.item_name}
            onChange={e => setFormData({...formData, item_name: e.target.value})}
          />
          <p className="text-xs text-slate-500 mt-2">Type a new item or select an existing one.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PositionSection title="1st Place" pos="first" color="border-amber-300 ring-1 ring-amber-100" />
          <PositionSection title="2nd Place" pos="second" color="border-slate-300 ring-1 ring-slate-100" />
          <PositionSection title="3rd Place" pos="third" color="border-orange-300 ring-1 ring-orange-100" />
        </div>

        <button 
          type="submit" 
          disabled={saving}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-70"
        >
          <Save size={24} />
          <span>{saving ? 'Saving...' : 'Save Result'}</span>
        </button>
      </form>
    </div>
  );
}
