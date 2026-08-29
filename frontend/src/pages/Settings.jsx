import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Save, Plus, Trash2, Edit2 } from 'lucide-react';

export default function Settings() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await apiClient('/categories');
      if (data) {
        setCategories(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = (id, field, value) => {
    setCategories(cats => cats.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleSave = async (category) => {
    setSaving(true);
    setMessage('');
    try {
      await apiClient(`/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: category.name,
          first_points: category.first_points,
          second_points: category.second_points,
          third_points: category.third_points
        })
      });
      setMessage(`Category '${category.name}' saved successfully.`);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName) return;
    setSaving(true);
    try {
      const newCat = await apiClient('/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newCatName,
          first_points: 10,
          second_points: 5,
          third_points: 3
        })
      });
      setCategories([...categories, newCat]);
      setNewCatName('');
      setMessage('Category added successfully.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category? Active results may be affected.')) return;
    setSaving(true);
    try {
      await apiClient(`/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter(c => c.id !== id));
      setMessage('Category deleted.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Scoring Categories</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 mb-6">
          Set the points awarded for each position in different categories. Changing these values will apply to all FUTURE results, and past results will retain their points.
        </p>

        {message && (
          <div className={`p-4 rounded-lg mb-6 text-sm ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat.id} className="p-5 border border-slate-200 rounded-lg bg-slate-50 relative">
              <div className="flex justify-between items-center mb-4">
                <input 
                  type="text" 
                  value={cat.name}
                  onChange={(e) => handleUpdateCategory(cat.id, 'name', e.target.value)}
                  className="text-xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-1"
                />
                <button 
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete Category"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-bold text-amber-600 mb-2">1st Place Points</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border border-amber-200 bg-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-center"
                    value={cat.first_points}
                    onChange={e => handleUpdateCategory(cat.id, 'first_points', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">2nd Place Points</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border border-slate-200 bg-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-500 outline-none font-bold text-center"
                    value={cat.second_points}
                    onChange={e => handleUpdateCategory(cat.id, 'second_points', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-orange-600 mb-2">3rd Place Points</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border border-orange-200 bg-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none font-bold text-center"
                    value={cat.third_points}
                    onChange={e => handleUpdateCategory(cat.id, 'third_points', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={() => handleSave(cat)}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center space-x-2 transition-colors disabled:opacity-70 text-sm"
                >
                  <Save size={16} />
                  <span>Save</span>
                </button>
              </div>
            </div>
          ))}

          {categories.length === 0 && (
            <div className="text-center py-6 text-slate-500">No categories found.</div>
          )}

          <div className="border-t border-slate-200 pt-6 mt-6">
            <form onSubmit={handleAddCategory} className="flex gap-4">
              <input 
                type="text" 
                placeholder="New Category Name" 
                className="flex-1 border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-indigo-500"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <button 
                type="submit" 
                disabled={!newCatName || saving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center space-x-2 transition-colors disabled:opacity-70"
              >
                <Plus size={18} />
                <span>Add Category</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
