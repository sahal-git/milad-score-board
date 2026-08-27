import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Trophy, Settings, List, PlusCircle, Menu, X, LogOut, Shield, ShieldAlert, MonitorUp } from 'lucide-react';
import { apiClient } from './api/client';
import { supabase } from './lib/supabase';

import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import AddResult from './pages/AddResult';
import Results from './pages/Results';
import Leaderboard from './pages/Leaderboard';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import PublicPage from './pages/PublicPage';

// Super Admin Pages
import SuperDashboard from './pages/SuperDashboard';
import InstitutionsList from './pages/InstitutionsList';
import ManageInstitution from './pages/ManageInstitution';

function InstitutionSidebar({ mobileOpen, setMobileOpen, onLogout, user }) {
  const location = useLocation();
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Add Result', path: '/results/add', icon: PlusCircle },
    { name: 'Results', path: '/results', icon: List },
    { name: 'Teams', path: '/teams', icon: Users },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const sidebarClass = `fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out md:translate-x-0 flex flex-col ${
    mobileOpen ? 'translate-x-0' : '-translate-x-full'
  }`;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" onClick={() => setMobileOpen(false)} />}
      <div className={sidebarClass}>
        <div className="flex flex-col p-4 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Milaad Fest</h1>
            <button className="md:hidden" onClick={() => setMobileOpen(false)}><X size={24} /></button>
          </div>
          <div className="text-sm text-indigo-300 mt-1">Institution Admin</div>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.name} to={item.path} onClick={() => setMobileOpen(false)}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} /><span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button onClick={onLogout} className="flex items-center space-x-3 p-3 w-full rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            <LogOut size={20} /><span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}

function SuperSidebar({ mobileOpen, setMobileOpen, onLogout }) {
  const location = useLocation();
  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Institutions', path: '/institutions', icon: Shield },
  ];

  const sidebarClass = `fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out md:translate-x-0 flex flex-col ${
    mobileOpen ? 'translate-x-0' : '-translate-x-full'
  }`;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" onClick={() => setMobileOpen(false)} />}
      <div className={sidebarClass}>
        <div className="flex flex-col p-4 border-b border-slate-700 bg-indigo-900">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold flex items-center space-x-2"><ShieldAlert size={20}/> <span>Control Panel</span></h1>
            <button className="md:hidden" onClick={() => setMobileOpen(false)}><X size={24} /></button>
          </div>
          <div className="text-sm text-indigo-300 mt-1">Super Admin</div>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.name} to={item.path} onClick={() => setMobileOpen(false)}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} /><span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button onClick={onLogout} className="flex items-center space-x-3 p-3 w-full rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            <LogOut size={20} /><span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authErrorMsg, setAuthErrorMsg] = useState('');

  // Bypass Auth entirely if rendering a public route
  const isPublicRoute = window.location.pathname.startsWith('/public');

  const isSuperAdminMode = user && user.role === 'super_admin';
  const openInstId = localStorage.getItem('super_open_institution_id');
  const isViewingInstitution = isSuperAdminMode && openInstId;

  useEffect(() => {
    if (isPublicRoute) return; // Skip auth checks on public page

    const handleAuthError = (e) => {
      setUser(null);
      setAuthErrorMsg(e.detail || 'Session expired or suspended. Please login again.');
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [isPublicRoute]);

  useEffect(() => {
    if (isPublicRoute) {
      setLoading(false);
      return;
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        apiClient('/me')
          .then(data => setUser(data))
          .catch(() => setUser(null))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, [isPublicRoute]);

  const handleLogin = () => {
    setAuthErrorMsg('');
    apiClient('/me')
      .then(data => setUser(data))
      .catch(console.error);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('super_open_institution_id');
    setUser(null);
  };

  const closeInstitutionView = () => {
    localStorage.removeItem('super_open_institution_id');
    window.location.href = '/institutions';
  };

  if (isPublicRoute) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/public/:code" element={<PublicPage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  if (loading) return <div className="p-8 text-center text-slate-500 min-h-screen flex items-center justify-center">Loading...</div>;

  if (!user) {
    return (
      <>
        {authErrorMsg && (
          <div className="fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded shadow-lg z-50">
            {authErrorMsg}
          </div>
        )}
        <Login onLogin={handleLogin} />
      </>
    );
  }

  // If super admin is viewing an institution, they get the institution layout
  const activeRole = isViewingInstitution ? 'institution_admin' : user.role;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        {activeRole === 'super_admin' ? (
          <SuperSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onLogout={handleLogout} />
        ) : (
          <InstitutionSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onLogout={handleLogout} user={user} />
        )}
        
        <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
          {isViewingInstitution && (
            <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex justify-between items-center z-40 sticky top-0 md:top-0">
              <div className="flex items-center space-x-2 text-amber-800 font-medium text-sm">
                <ShieldAlert size={16} />
                <span>SUPER ADMIN MODE: Viewing Institution #{openInstId}</span>
              </div>
              <button onClick={closeInstitutionView} className="bg-amber-200 text-amber-900 px-3 py-1 rounded text-xs font-bold hover:bg-amber-300">
                Return to Control Panel
              </button>
            </div>
          )}

          <header className={`bg-white border-b border-slate-200 flex items-center p-4 md:hidden ${isViewingInstitution ? '' : 'sticky top-0 z-30'}`}>
            <button onClick={() => setMobileOpen(true)} className="p-2 mr-4 bg-slate-100 rounded-lg text-slate-600">
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800">{activeRole === 'super_admin' ? 'Control Panel' : 'Milaad Fest'}</h1>
          </header>
          
          <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
            <div className="max-w-5xl mx-auto">
              {activeRole === 'super_admin' ? (
                <Routes>
                  <Route path="/" element={<SuperDashboard />} />
                  <Route path="/institutions" element={<InstitutionsList />} />
                  <Route path="/institutions/:id" element={<ManageInstitution />} />
                  <Route path="*" element={<SuperDashboard />} />
                </Routes>
              ) : (
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/teams" element={<Teams />} />
                  <Route path="/results/add" element={<AddResult />} />
                  <Route path="/results" element={<Results />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Dashboard />} />
                </Routes>
              )}
            </div>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
