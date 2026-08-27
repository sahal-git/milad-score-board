import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';
import { Settings, Plus, Search } from 'lucide-react';

export default function InstitutionsList() {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, suspended
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  const navigate = useNavigate();

  const fetchInstitutions = async () => {
    try {
      const data = await apiClient('/super/institutions');
      setInstitutions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setSaving(true);
    try {
      const result = await apiClient('/super/institutions', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData({ name: '', code: '', username: '', password: '', confirmPassword: '' });
      fetchInstitutions();
      navigate(`/institutions/${result.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = institutions.filter(inst => {
    if (filter !== 'all' && inst.status !== filter) return false;
    const s = search.toLowerCase();
    return inst.name.toLowerCase().includes(s) || inst.code.toLowerCase().includes(s);
  });

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Institutions</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
        >
          <Plus size={18} />
          <span>Create Institution</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by name or code..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="border border-slate-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-sm">
                <th className="p-4">Institution</th>
                <th className="p-4">Code</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Teams</th>
                <th className="p-4 text-center">Results</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inst => (
                <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold text-slate-800">{inst.name}</td>
                  <td className="p-4 font-mono text-slate-600">{inst.code}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      inst.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {inst.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-center text-slate-600">{inst.team_count}</td>
                  <td className="p-4 text-center text-slate-600">{inst.result_count}</td>
                  <td className="p-4 text-right">
                    <Link to={`/institutions/${inst.id}`} className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded">
                      <Settings size={16} />
                      <span className="text-sm font-medium">Manage</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">No institutions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create Institution</h2>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">{error}</div>}
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Institution Name *</label>
                <input required type="text" className="w-full border border-slate-300 rounded px-3 py-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Institution Code *</label>
                <input required type="text" className="w-full border border-slate-300 rounded px-3 py-2 uppercase" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Username *</label>
                <input required type="text" className="w-full border border-slate-300 rounded px-3 py-2" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Password *</label>
                <input required type="password" className="w-full border border-slate-300 rounded px-3 py-2" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password *</label>
                <input required type="password" className="w-full border border-slate-300 rounded px-3 py-2" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded hover:bg-slate-200">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-70">
                  {saving ? 'Creating...' : 'Create Institution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
