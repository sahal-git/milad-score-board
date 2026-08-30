import re

with open('frontend/src/pages/Teams.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Form addition
form_old = """<div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Short Name (optional)</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.short_name}
                  onChange={e => setFormData({...formData, short_name: e.target.value})}
                />
              </div>
            </div>"""

form_new = """<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Short Name (optional)</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.short_name}
                  onChange={e => setFormData({...formData, short_name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL (optional)</label>
                <input
                  type="text"
                  placeholder="https://example.com/logo.png"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.logo_url}
                  onChange={e => setFormData({...formData, logo_url: e.target.value})}
                />
              </div>
            </div>"""

if form_old in code:
    code = code.replace(form_old, form_new)
else:
    # If indentation is off, try regex
    code = re.sub(r'<div className="flex gap-4">[\s\S]*?</div>\s*</div>', form_new, code)

# Display addition
display_old = """<div className="bg-indigo-100 text-indigo-600 p-3 rounded-full">
                  <Users size={20} />
                </div>"""

display_new = """{team.logo_url ? (
                  <img src={team.logo_url} alt={team.name} className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-sm bg-white flex-shrink-0" />
                ) : (
                  <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full flex-shrink-0">
                    <Users size={20} />
                  </div>
                )}"""
                
if display_old in code:
    code = code.replace(display_old, display_new)
else:
    code = re.sub(r'<div className="bg-indigo-100 text-indigo-600 p-3 rounded-full">[\s\S]*?</div>', display_new, code)

with open('frontend/src/pages/Teams.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
