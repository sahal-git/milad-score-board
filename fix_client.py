import re

with open('client.orig.js', 'r', encoding='utf-16-le') as f:
    code = f.read()

# 1. Dashboard
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

# 2. Leaderboard
leaderboard_old = r"if \(endpoint === '/leaderboard'\) \{[\s\S]*?return board\.sort\(\(a, b\) => b\.totalPoints - a\.totalPoints\);\n    \}"
leaderboard_new = r"""if (endpoint === '/leaderboard') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      if (!instId) return [];

      const { data: teams, error: tErr } = await supabase.from('teams').select('id, name, logo_url').eq('institution_id', instId);
      if (tErr) throw tErr;

      const { data: results, error: rErr } = await supabase.from('results')
        .select('team_id, position, points_awarded, scoring_category_id, programme_category, programme')
        .eq('institution_id', instId);
      if (rErr) throw rErr;

      const board = teams.map(t => {
        const teamResults = results.filter(r => r.team_id === t.id);
        const teamBreakdown = teamResults.map(r => ({
          category_id: r.scoring_category_id,
          programme_category: r.programme_category || 'general',
          programme: (r.programme || '').trim(),
          points: r.points_awarded,
          position: r.position
        }));

        return {
          id: t.id,
          name: t.name,
          logo_url: t.logo_url,
          firstCount: teamResults.filter(r => r.position === 1).length,
          secondCount: teamResults.filter(r => r.position === 2).length,
          thirdCount: teamResults.filter(r => r.position === 3).length,
          totalPoints: teamResults.reduce((sum, r) => sum + r.points_awarded, 0),
          breakdown: teamBreakdown
        };
      });

      return board.sort((a, b) => b.totalPoints - a.totalPoints);
    }"""
code = re.sub(leaderboard_old, leaderboard_new, code)

# 3. Items and Candidates
code = re.sub(r"// /items\s+if \(endpoint === '/items'\) \{[\s\S]*?// /results", "// /results", code)
code = re.sub(r"// /candidates\s+if \(endpoint === '/candidates'\) \{[\s\S]*?// Super Admin Routes", "// Super Admin Routes", code)

# 4. Results
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

# 5. Results ID
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

with open('frontend/src/api/client.js', 'w', encoding='utf-8') as f:
    f.write(code)
