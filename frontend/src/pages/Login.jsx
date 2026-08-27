import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // In Supabase we use email to login. We construct the fake email:
      const email = `${username}@milaadfest.local`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }
      
      onLogin(); // App.jsx will fetch profile on session change
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-100 text-indigo-600 p-4 rounded-full mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Login
          </h1>
          <p className="text-slate-500 text-center mt-2">
            Enter your credentials to access the system.
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm mb-6 text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              required
              type="text"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. admin"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              required
              type="password"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors disabled:opacity-70 mt-4"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
