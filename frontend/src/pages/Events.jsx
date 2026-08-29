import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';

const PROGRAMME_CATEGORIES = [
  'kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'
];

const formatCategory = (str) => {
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function Events() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('general');

  // Edit form state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCat, setEditCat] = useState('general');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const data = await apiClient('/items');
      setItems(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const newItem = await apiClient('/items', {
        method: 'POST',
        body: JSON.stringify({ name: newName, programme_category: newCat })
      });
      setItems([...items, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAdd(false);
      setNewName('');
      setNewCat('general');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCat(item.programme_category);
  };

  const handleUpdate = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await apiClient(`/items/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, programme_category: editCat })
      });
      setItems(items.map(i => i.id === editingId ? updated : i).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event? All associated results will be deleted.')) return;
    try {
      await apiClient(`/items/${id}`, { method: 'DELETE' });
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Programmes (Events)</h1>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center space-x-2 text-sm"
        >
          {showAdd ? <X size={18} /> : <Plus size={18} />}
          <span>{showAdd ? 'Cancel' : 'Add Programme'}</span>
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Programme Name</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Quran Recitation"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <div className="md:w-64">
            <label className="block text-sm font-medium text-slate-700 mb-1">Programme Category</label>
            <select
              className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
            >
              {PROGRAMME_CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-70 h-[42px]"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-sm">
              <th className="p-4">Programme Name</th>
              <th className="p-4">Category</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-8 text-center text-slate-500">No programmes found.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    {editingId === item.id ? (
                      <input 
                        type="text"
                        className="w-full px-3 py-1 border border-slate-300 rounded outline-none focus:border-indigo-500"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                      />
                    ) : (
                      <span className="font-semibold text-slate-800">{item.name}</span>
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === item.id ? (
                      <select
                        className="w-full px-3 py-1 border border-slate-300 rounded outline-none focus:border-indigo-500 bg-white"
                        value={editCat}
                        onChange={e => setEditCat(e.target.value)}
                      >
                        {PROGRAMME_CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
                      </select>
                    ) : (
                      <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">
                        {formatCategory(item.programme_category || 'general')}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {editingId === item.id ? (
                      <>
                        <button onClick={handleUpdate} disabled={saving} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                          <Save size={18} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
