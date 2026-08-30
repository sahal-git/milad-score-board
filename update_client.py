import re

with open('frontend/src/api/client.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove items and candidates endpoints completely
items_candidates_pattern = r"if \(endpoint === '/items'\) \{[\s\S]*?\} else if \(endpoint === '/categories'\) \{"
code = re.sub(items_candidates_pattern, "if (endpoint === '/categories') {", code)

# Fallback regex in case it was modified
code = re.sub(r"if \(endpoint === '/items'\) \{[\s\S]*?\} else if", "if", code)
code = re.sub(r"if \(endpoint === '/candidates'\) \{[\s\S]*?\} else if", "if", code)

# 2. Update /dashboard block
dashboard_old = r"const { count: programmesCount } = await supabase\s*\.from\('items'\)\s*\.select\('\*', \{ count: 'exact', head: true \}\)\s*\.eq\('institution_id', instId\);"
dashboard_new = r"""const { data: programmesData } = await supabase
          .from('results')
          .select('programme')
          .eq('institution_id', instId);
        
        const uniqueProgrammes = new Set((programmesData || []).map(r => (r.programme || '').toLowerCase().trim()));
        const programmesCount = uniqueProgrammes.size;"""
code = re.sub(dashboard_old, dashboard_new, code)

# 3. Update /results block
results_old = r"if \(endpoint === '/results'\) \{[\s\S]*?if \(endpoint\.startsWith\('/results/'\)\) \{"
results_new = r"""if (endpoint === '/results') {
      if (method === 'GET') {
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        const { data, error } = await supabase
          .from('results')
          .select(`
            id, programme_category, programme, candidate_name, position, points_awarded, created_at,
            scoring_categories (id, name),
            teams (id, name)
          `)
          .eq('institution_id', instId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      }
      
      if (method === 'POST') {
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        const payload = options.body ? JSON.parse(options.body) : {};
        
        const { data, error } = await supabase
          .from('results')
          .insert({
             institution_id: instId,
             programme_category: payload.programme_category,
             programme: payload.programme,
             candidate_name: payload.candidate_name,
             team_id: payload.team_id,
             scoring_category_id: payload.scoring_category_id,
             position: payload.position,
             points_awarded: payload.points_awarded
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    }
    
    if (endpoint.startsWith('/results/')) {"""

code = re.sub(results_old, results_new, code)

# 4. Update /results/:id block
results_id_old = r"if \(endpoint\.startsWith\('/results/'\)\) \{[\s\S]*?// Super Admin Routes"
results_id_new = r"""if (endpoint.startsWith('/results/')) {
      const id = endpoint.split('/')[2];
      
      if (method === 'GET') {
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        
        const { data, error } = await supabase
          .from('results')
          .select(`
            id, programme_category, programme, candidate_name, position, points_awarded,
            scoring_category_id, team_id,
            teams (id, name),
            scoring_categories (id, name)
          `)
          .eq('id', id)
          .eq('institution_id', instId)
          .single();
          
        if (error) throw error;
        return data;
      }
      
      if (method === 'PUT') {
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        const payload = options.body ? JSON.parse(options.body) : {};
        
        const { data, error } = await supabase
          .from('results')
          .update({
             programme_category: payload.programme_category,
             programme: payload.programme,
             candidate_name: payload.candidate_name,
             team_id: payload.team_id,
             scoring_category_id: payload.scoring_category_id,
             position: payload.position,
             points_awarded: payload.points_awarded
          })
          .eq('id', id)
          .eq('institution_id', instId)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      
      if (method === 'DELETE') {
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        const { error } = await supabase.from('results').delete().eq('id', id).eq('institution_id', instId);
        if (error) throw error;
        return { success: true };
      }
    }

    // Super Admin Routes"""

code = re.sub(results_id_old, results_id_new, code)

# Write back
with open('frontend/src/api/client.js', 'w', encoding='utf-8') as f:
    f.write(code)
