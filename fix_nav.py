import re

with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

navItems_regex = r"  const navItems = \[\s*\{ name: 'Add Result', path: '/', icon: PlusCircle \},\s*\{ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard \},\s*\{ name: 'Add Result', path: '/results/add', icon: PlusCircle \},\s*\{ name: 'Results', path: '/results', icon: Trophy \},\s*\{ name: 'Teams', path: '/teams', icon: Users \},\s*\{ name: 'Leaderboard', path: '/leaderboard', icon: Trophy \},\s*\{ name: 'Settings', path: '/settings', icon: Settings \},\s*\];"

nav_new = """  const navItems = [
    { name: 'Add Result', path: '/', icon: PlusCircle },
    { name: 'Bulk Import', path: '/import', icon: UploadCloud },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Results', path: '/results', icon: Trophy },
    { name: 'Teams', path: '/teams', icon: Users },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];"""

code = re.sub(navItems_regex, nav_new, code)

with open('frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
