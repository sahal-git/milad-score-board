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
      const { count: totalItems } = await supabase.from('items').select('*', { count: 'exact', head: true }).eq('institution_id', instId);
      
      // We only count 1 result per event for 'completed' metrics usually, or count total rows.
      // Let's just keep total rows for totalResults.
      const { count: totalResults } = await supabase.from('results').select('*', { count: 'exact', head: true }).eq('institution_id', instId);
      
      const { data: items } = await supabase.from('items').select('id, programme_category').eq('institution_id', instId);
      const { data: results } = await supabase.from('results').select('item_id').eq('institution_id', instId);
      
      const completedItemIds = new Set(results?.map(r => r.item_id) || []);
      
      const progCategories = {};
      const predefined = ['kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'];
      predefined.forEach(cat => {
        progCategories[cat] = { name: cat, total: 0, completed: 0 };
      });

      for (const item of (items || [])) {
        const cat = item.programme_category;
        if (!progCategories[cat]) progCategories[cat] = { name: cat, total: 0, completed: 0 };
        progCategories[cat].total++;
        if (completedItemIds.has(item.id)) {
          progCategories[cat].completed++;
        }
      }

      return {
        institutionName: inst?.name,
        institutionCode: inst?.public_slug,
        totalTeams: totalTeams || 0,
        totalItems: totalItems || 0,
        totalResults: Math.floor((totalResults || 0) / 3), // 3 positions per result
        programmeCategories: Object.values(progCategories).filter(c => c.total > 0 || predefined.includes(c.name))
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
        .select('team_id, position, points_awarded, category_id, items(programme_category)')
        .eq('institution_id', instId);
      if (rErr) throw rErr;

      const board = teams.map(t => {
        const teamResults = results.filter(r => r.team_id === t.id);
        const teamBreakdown = teamResults.map(r => ({
          category_id: r.category_id,
          programme_category: r.items?.programme_category || 'general',
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

    // /items
    if (endpoint === '/items') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      if (method === 'GET') {
        const { data, error } = await supabase.from('items').select('*').eq('institution_id', instId).order('name', { ascending: true });
        if (error) throw error;
        return data;
      }
      
      if (method === 'POST') {
        const { name, programme_category } = options.body ? JSON.parse(options.body) : {};
        if (!name || !programme_category) throw new Error('Name and programme category are required');
        const { data, error } = await supabase.from('items').insert({
          institution_id: instId,
          name,
          programme_category
        }).select().single();
        if (error) throw error;
        return data;
      }
    }
    
    if (endpoint.startsWith('/items/')) {
      const id = endpoint.split('/')[2];
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      if (method === 'PUT') {
        const { name, programme_category } = options.body ? JSON.parse(options.body) : {};
        const { data, error } = await supabase.from('items').update({ name, programme_category }).eq('id', id).eq('institution_id', instId).select().single();
        if (error) throw error;
        return data;
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('items').delete().eq('id', id).eq('institution_id', instId);
        if (error) throw error;
        return { success: true };
      }
    }

    // /candidates
    if (endpoint === '/candidates') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      
      if (method === 'GET') {
        const { data, error } = await supabase.from('candidates').select('*').eq('institution_id', instId).order('name', { ascending: true });
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
        const { data, error } = await supabase.from('scoring_categories').insert([{ ...body, institution_id: instId }]).select().single();
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
        const { data, error } = await supabase.from('scoring_categories').update(body).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
    }

    // /results
    if (endpoint === '/results') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      
      if (method === 'GET') {
        const { data, error } = await supabase
          .from('results')
          .select(`
            id,
            created_at,
            position,
            points_awarded,
            items (id, name, programme_category),
            scoring_categories (id, name),
            candidates (id, name),
            teams (id, name)
          `)
          .eq('institution_id', instId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        const grouped = {};
        for (const r of data) {
          const itemId = r.items.id;
          if (!grouped[itemId]) {
            grouped[itemId] = {
              id: itemId,
              created_at: r.created_at,
              item_id: r.items.id,
              item_name: r.items.name,
              programme_category: r.items.programme_category,
              category_id: r.scoring_categories?.id,
              category_name: r.scoring_categories?.name,
            };
          }
          if (r.position === 1) {
            grouped[itemId].first_team_name = r.teams?.name;
            grouped[itemId].first_points = r.points_awarded;
          } else if (r.position === 2) {
            grouped[itemId].second_team_name = r.teams?.name;
            grouped[itemId].second_points = r.points_awarded;
          } else if (r.position === 3) {
            grouped[itemId].third_team_name = r.teams?.name;
            grouped[itemId].third_points = r.points_awarded;
          }
        }
        return Object.values(grouped).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      if (method === 'POST') {
        const payload = options.body ? JSON.parse(options.body) : {};
        const { data, error } = await supabase.rpc('create_result', {
          p_institution_id: instId,
          p_item_id: payload.item_id,
          p_category_id: payload.category_id,
          p_first_candidate_name: payload.first_candidate_name || null,
          p_first_team_id: payload.first_team_id || null,
          p_second_candidate_name: payload.second_candidate_name || null,
          p_second_team_id: payload.second_team_id || null,
          p_third_candidate_name: payload.third_candidate_name || null,
          p_third_team_id: payload.third_team_id || null
        });
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
            id, position, points_awarded,
            items (id, name, programme_category),
            scoring_categories (id, name),
            candidates (id, name),
            teams (id, name)
          `)
          .eq('item_id', id)
          .eq('institution_id', instId);
          
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Not found');
        
        const r0 = data[0];
        const res = {
          item_id: r0.items.id,
          item_name: r0.items.name,
          programme_category: r0.items.programme_category,
          category_id: r0.scoring_categories.id,
          category_name: r0.scoring_categories.name,
        };
        
        for (const r of data) {
          if (r.position === 1) {
            res.first_candidate_name = r.candidates?.name;
            res.first_team_id = r.teams?.id;
          } else if (r.position === 2) {
            res.second_candidate_name = r.candidates?.name;
            res.second_team_id = r.teams?.id;
          } else if (r.position === 3) {
            res.third_candidate_name = r.candidates?.name;
            res.third_team_id = r.teams?.id;
          }
        }
        return res;
      }
      
      if (method === 'PUT') {
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        const payload = options.body ? JSON.parse(options.body) : {};
        
        const { data, error } = await supabase.rpc('update_result', {
          p_institution_id: instId,
          p_item_id: id,
          p_category_id: payload.category_id,
          p_first_candidate_name: payload.first_candidate_name || null,
          p_first_team_id: payload.first_team_id || null,
          p_second_candidate_name: payload.second_candidate_name || null,
          p_second_team_id: payload.second_team_id || null,
          p_third_candidate_name: payload.third_candidate_name || null,
          p_third_team_id: payload.third_team_id || null
        });
        if (error) throw error;
        return data;
      }
      
      if (method === 'DELETE') {
        // Here `id` is the item_id because we group by item_id
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        const { error } = await supabase.from('results').delete().eq('item_id', id).eq('institution_id', instId);
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
        
        if (method === 'PUT' && action) {
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
      }
    }

    throw new Error('Not implemented locally yet: ' + endpoint);
  } catch (error) {
    console.error(`[apiClient] Error on ${method} ${endpoint}:`, error);
    throw new Error(error.message || 'API Error');
  }
};
