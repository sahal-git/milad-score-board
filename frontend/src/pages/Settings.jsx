import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Save } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    first_points: 10,
    second_points: 6,
    third_points: 3
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await apiClient('/score-settings');
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await apiClient('/score-settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      setMessage('Settings saved successfully. Leaderboard updated.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Score Settings</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 mb-6">
          Set the points awarded for each position. Changing these values will immediately recalculate the entire leaderboard based on existing results.
        </p>

        {message && (
          <div className={`p-4 rounded-lg mb-6 text-sm ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-amber-600 mb-2">1st Place Points</label>
              <input
                required
                type="number"
                min="0"
                className="w-full border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-xl font-bold text-center"
                value={settings.first_points}
                onChange={e => setSettings({...settings, first_points: parseInt(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">2nd Place Points</label>
              <input
                required
                type="number"
                min="0"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-3 focus:ring-2 focus:ring-slate-500 outline-none text-xl font-bold text-center"
                value={settings.second_points}
                onChange={e => setSettings({...settings, second_points: parseInt(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-orange-600 mb-2">3rd Place Points</label>
              <input
                required
                type="number"
                min="0"
                className="w-full border border-orange-200 bg-orange-50 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none text-xl font-bold text-center"
                value={settings.third_points}
                onChange={e => setSettings({...settings, third_points: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors disabled:opacity-70"
          >
            <Save size={20} />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
