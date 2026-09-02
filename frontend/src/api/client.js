import { supabase } from '../lib/supabase';

export const apiClient = async (endpoint, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : null;
  const openInstId = localStorage.getItem('super_open_institution_id');

  const { data: { session } } = await supabase.auth.getSession();
  
  const ensureAuth = async () => {
    if (!session) {
      window.dispatchEvent(new CustomEvent('auth-error', { detail: 'Session expired' }));
      throw new Error('Unauthorized');
    }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) {
      window.dispatchEvent(new CustomEvent('auth-error', { detail: 'Profile not found' }));
      throw new Error('Unauthorized');
    }
    return profile;
  };

  try {
    // /me
    if (endpoint === '/me') {
      const profile = await ensureAuth();
      return { id: profile.id, username: profile.username, role: profile.role, institution_id: profile.institution_id };
    }

    // /dashboard
    if (endpoint === '/dashboard') {
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
    }

    // /leaderboard
    if (endpoint === '/leaderboard') {
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
    }

    // /teams
    if (endpoint === '/teams') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      
      if (method === 'GET') {
        const { data, error } = await supabase.from('teams').select('*').eq('institution_id', instId).order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      }
      
      if (method === 'POST') {
        const { data, error } = await supabase.from('teams').insert([{ ...body, institution_id: instId }]).select().single();
        if (error) throw error;
        return data;
      }
    }
    if (endpoint.startsWith('/teams/')) {
      const id = endpoint.split('/')[2];
      if (method === 'DELETE') {
        const { error } = await supabase.from('teams').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      }
      if (method === 'PUT') {
        const { data, error } = await supabase.from('teams').update(body).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
    }

    // /categories
    if (endpoint === '/categories') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      
      if (method === 'GET') {
        const { data, error } = await supabase.from('scoring_categories').select('*').eq('institution_id', instId).order('name', { ascending: true });
        if (error) throw error;
        return data;
      }
      
      if (method === 'POST') {
        const payload = options.body ? JSON.parse(options.body) : {};
        const { data, error } = await supabase.from('scoring_categories').insert([{ ...payload, institution_id: instId }]).select().single();
        if (error) throw error;
        return data;
      }
    }
    
    if (endpoint.startsWith('/categories/')) {
      const id = endpoint.split('/')[2];
      if (method === 'DELETE') {
        const { error } = await supabase.from('scoring_categories').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      }
      if (method === 'PUT') {
        const payload = options.body ? JSON.parse(options.body) : {};
        const { data, error } = await supabase.from('scoring_categories').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
    }

    // /results
    if (endpoint === '/results') {
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
    
    if (endpoint.startsWith('/results/')) {
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

    // Super Admin Routes
    if (endpoint.startsWith('/super/')) {
      const profile = await ensureAuth();
      if (profile.role !== 'super_admin') throw new Error('Forbidden');
      
      if (endpoint === '/super/institutions') {
        if (method === 'GET') {
          const { data, error } = await supabase.from('institutions').select(`
             *,
             profiles(username, id)
          `).order('created_at', { ascending: false });
          if (error) throw error;
          
          return data.map(i => ({
             ...i,
             admin_username: i.profiles[0]?.username
          }));
        }
        
        if (method === 'POST') {
          const payload = {
            name: body.name,
            code: body.code,
            place: body.place,
            logo_url: body.logo_url || null,
            public_slug: body.code.toLowerCase(),
            admin_username: body.username,
            admin_password: body.password
          };
          const { data, error } = await supabase.functions.invoke('admin-operations', {
            body: { action: 'create_institution', payload }
          });
          if (error) throw error;
          if (data.error) throw new Error(data.error);
          return data.institution;
        }
      }
      
      if (endpoint.startsWith('/super/institutions/')) {
        const parts = endpoint.split('/');
        const id = parts[3];
        const action = parts[4]; // suspend, activate, reset-password
        
        if (method === 'DELETE') {
          const { data, error } = await supabase.functions.invoke('admin-operations', {
            body: { action: 'delete_institution', payload: { id } }
          });
          if (error) throw error;
          if (data.error) throw new Error(data.error);
          return { success: true };
        }
        
        if (method === 'PUT' && (action === 'suspend' || action === 'activate')) {
           const { data, error } = await supabase.functions.invoke('admin-operations', {
             body: { action: action === 'suspend' ? 'suspend_institution' : 'activate_institution', payload: { id } }
           });
           if (error) throw error;
           if (data.error) throw new Error(data.error);
           return { success: true };
        }
        
        if (method === 'POST' && action === 'reset-password') {
           const { data, error } = await supabase.functions.invoke('admin-operations', {
             body: { action: 'reset_password', payload: { institution_id: id, new_password: body.new_password } }
           });
           if (error) throw error;
           if (data.error) throw new Error(data.error);
           return { success: true };
        }
        
        if (method === 'PUT' && action === 'edit') {
           const { data, error } = await supabase.from('institutions').update({
             name: body.name,
             code: body.code,
             place: body.place,
             public_slug: body.public_slug,
             logo_url: body.logo_url,
             banner_url: body.banner_url,
             theme_color_1: body.theme_color_1,
             theme_color_2: body.theme_color_2
           }).eq('id', id).select().single();
           if (error) throw error;
           return data;
        }
      }
    }

    throw new Error('Not implemented locally yet: ' + endpoint);
  } catch (error) {
    console.error(`[apiClient] Error on ${method} ${endpoint}:`, error);
    throw new Error(error.message || 'API Error');
  }
};
