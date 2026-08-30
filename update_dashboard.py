import re

with open('frontend/src/api/client.js', 'r', encoding='utf-8') as f:
    code = f.read()

dashboard_old = r"if \(endpoint === '/dashboard'\) \{[\s\S]*?return \{[\s\S]*?\};\n    \}"

dashboard_new = r"""if (endpoint === '/dashboard') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      if (!instId) throw new Error('No institution context');

      const { data: inst } = await supabase.from('institutions').select('name, public_slug').eq('id', instId).single();
      const { count: totalTeams } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('institution_id', instId);
      
      const { data: resultsData } = await supabase.from('results').select('programme, programme_category').eq('institution_id', instId);
      
      const uniqueProgrammes = new Set((resultsData || []).map(r => (r.programme || '').toLowerCase().trim()));
      const totalItems = uniqueProgrammes.size;
      const totalResults = (resultsData || []).length;
      
      const programmeCategories = {
        'kiddies': { total: 0, completed: 0 },
        'sub_junior': { total: 0, completed: 0 },
        'junior': { total: 0, completed: 0 },
        'senior': { total: 0, completed: 0 },
        'super_senior': { total: 0, completed: 0 },
        'general': { total: 0, completed: 0 }
      };

      // Since we don't have predefined events, we'll just show the count of unique programmes per category
      const catCount = {};
      (resultsData || []).forEach(r => {
         const key = r.programme_category + '|' + (r.programme || '').toLowerCase().trim();
         if (!catCount[key]) {
             catCount[key] = true;
             if (programmeCategories[r.programme_category]) {
                programmeCategories[r.programme_category].total += 1;
                programmeCategories[r.programme_category].completed += 1;
             }
         }
      });
      
      return { 
        totalTeams: totalTeams || 0, 
        totalItems, 
        totalResults, 
        institutionName: inst?.name,
        institutionCode: inst?.public_slug,
        programmeCategories
      };
    }"""

code = re.sub(dashboard_old, dashboard_new, code)

with open('frontend/src/api/client.js', 'w', encoding='utf-8') as f:
    f.write(code)
