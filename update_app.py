with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Import the component
code = code.replace("import EditResult from './pages/EditResult';", "import EditResult from './pages/EditResult';\nimport ImportResults from './pages/ImportResults';")

# Add UploadCloud icon to lucide-react
code = code.replace("Menu, X, LogOut, LayoutDashboard, Trophy, Users, Shield, Settings, ShieldAlert", "Menu, X, LogOut, LayoutDashboard, Trophy, Users, Shield, Settings, ShieldAlert, UploadCloud")

# Add to navItems
navItems_old = """  const navItems = [
    { name: 'Add Result', path: '/', icon: Trophy },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Results', path: '/results', icon: Trophy },
    { name: 'Teams', path: '/teams', icon: Users },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];"""

navItems_new = """  const navItems = [
    { name: 'Add Result', path: '/', icon: Trophy },
    { name: 'Bulk Import', path: '/import', icon: UploadCloud },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Results', path: '/results', icon: Trophy },
    { name: 'Teams', path: '/teams', icon: Users },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];"""
code = code.replace(navItems_old, navItems_new)

# Add Route
route_old = "<Route path=\"/results\" element={<Results />} />"
route_new = "<Route path=\"/results\" element={<Results />} />\n                  <Route path=\"/import\" element={<ImportResults />} />"
code = code.replace(route_old, route_new)

with open('frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
