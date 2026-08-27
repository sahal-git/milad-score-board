import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { ExternalLink, Key, Ban, CheckCircle, Trash2 } from 'lucide-react';

export default function ManageInstitution() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [passwordForm, setPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const data = await apiClient('/super/institutions');
      const found = data.find(i => i.id === parseInt(id));
      if (found) setInstitution(found);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = institution.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'activate'} this institution?`)) return;
    
    try {
      await apiClient(`/super/institutions/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassError('Passwords do not match');
      return;
    }
    
    try {
      await apiClient(`/super/institutions/${id}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword })
      });
      alert('Password reset successfully!');
      setPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassError(err.message);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (deleteConfirm !== institution.code) {
      alert('Code does not match.');
      return;
    }
    try {
      await apiClient(`/super/institutions/${id}`, { method: 'DELETE' });
      navigate('/institutions');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenInstitution = () => {
    localStorage.setItem('super_open_institution_id', institution.id);
    window.location.href = '/';
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!institution) return <div className="p-8 text-center">Institution not found.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Manage Institution</h1>
        <button 
          onClick={handleOpenInstitution}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
        >
          <ExternalLink size={18} />
          <span>Open Institution</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-slate-500 font-medium">Institution Name</p>
          <p className="text-xl font-bold text-slate-800">{institution.name}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Institution Code</p>
          <p className="text-xl font-mono text-slate-800">{institution.code}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Status</p>
          <p className="mt-1">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              institution.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {institution.status.toUpperCase()}
            </span>
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Admin Username</p>
          <p className="text-lg font-medium text-slate-700">{institution.admin_username}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Teams</p>
          <p className="text-lg font-medium text-slate-700">{institution.team_count}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Results</p>
          <p className="text-lg font-medium text-slate-700">{institution.result_count}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-lg flex items-center space-x-2"><Ban size={20} /> <span>Status Control</span></h2>
          <p className="text-sm text-slate-600">
            {institution.status === 'active' 
              ? "Suspending will block all institution admin access immediately, but data will be preserved." 
              : "Activating will restore full access to the institution admin."}
          </p>
          <button 
            onClick={handleStatusToggle}
            className={`w-full py-2 rounded-lg font-bold text-white transition-colors ${
              institution.status === 'active' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {institution.status === 'active' ? 'Suspend Institution' : 'Activate Institution'}
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-lg flex items-center space-x-2"><Key size={20} /> <span>Password Reset</span></h2>
          <p className="text-sm text-slate-600">Reset the login password for this institution's admin account.</p>
          
          {!passwordForm ? (
            <button onClick={() => setPasswordForm(true)} className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">
              Reset Admin Password
            </button>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-3">
              {passError && <div className="text-red-600 text-sm">{passError}</div>}
              <input required type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2" />
              <input required type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2" />
              <div className="flex space-x-2">
                <button type="button" onClick={() => setPasswordForm(false)} className="flex-1 py-2 bg-slate-100 rounded text-slate-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded">Save</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="bg-red-50 p-6 rounded-xl border border-red-200 space-y-4 mt-8">
        <h2 className="font-bold text-lg text-red-700 flex items-center space-x-2"><Trash2 size={20} /> <span>Danger Zone</span></h2>
        <p className="text-sm text-red-600">
          Deleting this institution will permanently wipe all its teams, items, candidates, results, and settings. This cannot be undone.
        </p>
        
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700">
            Delete Institution
          </button>
        ) : (
          <form onSubmit={handleDelete} className="bg-white p-4 rounded-lg border border-red-300 space-y-3">
            <p className="font-bold text-red-700">Type <span className="font-mono bg-red-100 px-1">{institution.code}</span> to confirm deletion:</p>
            <input required type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="w-full border border-red-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex space-x-2">
              <button type="button" onClick={() => setShowDelete(false)} className="px-4 py-2 bg-slate-100 rounded text-slate-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Permanently Delete</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
