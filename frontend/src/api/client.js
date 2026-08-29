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

      const { data: inst } = await supabase.from('institutions').select('name, code').eq('id', instId).single();
      const { count: totalTeams } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('institution_id', instId);
      const { count: totalItems } = await supabase.from('items').select('*', { count: 'exact', head: true }).eq('institution_id', instId);
      const { count: totalResults } = await supabase.from('results').select('*', { count: 'exact', head: true }).eq('institution_id', instId);
      
      return {
        totalTeams: totalTeams || 0,
        totalItems: totalItems || 0,
        totalResults: totalResults || 0,
        institutionName: inst?.name || '',
        institutionCode: inst?.code || ''
      };
    }

    // /leaderboard
    if (endpoint === '/leaderboard') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      if (!instId) return [];

      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('institution_id', instId)
        .order('total_points', { ascending: false });
        
      if (error) throw error;
      
      // format to match old output
      return (data || []).map(row => ({
        id: row.team_id,
        name: row.team_name,
        logo_url: row.logo_url,
        firstCount: Number(row.first_count),
        secondCount: Number(row.second_count),
        thirdCount: Number(row.third_count),
        totalPoints: Number(row.total_points),
        categoryPoints: row.category_points || {}
      }));
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
        // Group results by event
        const { data, error } = await supabase
          .from('results')
          .select(`
            id,
            created_at,
            position,
            points_awarded,
            items (id, name),
            scoring_categories (id, name),
            candidates (id, name),
            teams (id, name)
          `)
          .eq('institution_id', instId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        // Transform normalized data into grouped format
        const grouped = {};
        for (const r of data) {
          const itemId = r.items.id;
          if (!grouped[itemId]) {
            grouped[itemId] = {
              id: itemId, // use item_id as the primary key for the grouped result
              created_at: r.created_at,
              item_id: r.items.id,
              item_name: r.items.name,
              category_id: r.scoring_categories.id,
              category_name: r.scoring_categories.name,
            };
          }
          
          if (r.position === 1) {
            grouped[itemId].first_candidate_id = r.candidates?.id;
            grouped[itemId].first_candidate = r.candidates?.name;
            grouped[itemId].first_team_id = r.teams?.id;
            grouped[itemId].first_team = r.teams?.name;
            grouped[itemId].first_points = r.points_awarded;
          } else if (r.position === 2) {
            grouped[itemId].second_candidate_id = r.candidates?.id;
            grouped[itemId].second_candidate = r.candidates?.name;
            grouped[itemId].second_team_id = r.teams?.id;
            grouped[itemId].second_team = r.teams?.name;
            grouped[itemId].second_points = r.points_awarded;
          } else if (r.position === 3) {
            grouped[itemId].third_candidate_id = r.candidates?.id;
            grouped[itemId].third_candidate = r.candidates?.name;
            grouped[itemId].third_team_id = r.teams?.id;
            grouped[itemId].third_team = r.teams?.name;
            grouped[itemId].third_points = r.points_awarded;
          }
        }
        
        return Object.values(grouped).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      if (method === 'POST') {
        const { data, error } = await supabase.rpc('create_result', {
          p_institution_id: instId,
          p_item_name: body.item_name,
          p_category_id: body.category_id,
          p_first_candidate_name: body.first_candidate_name,
          p_first_team_id: body.first_team_id,
          p_second_candidate_name: body.second_candidate_name,
          p_second_team_id: body.second_team_id,
          p_third_candidate_name: body.third_candidate_name,
          p_third_team_id: body.third_team_id
        });
        if (error) throw error;
        return { success: true, item_id: data };
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
            items (id, name),
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
          category_id: r0.scoring_categories.id,
          category_name: r0.scoring_categories.name,
        };
        
        for (const r of data) {
          if (r.position === 1) {
            res.first_candidate_name = r.candidates?.name || '';
            res.first_team_id = r.teams?.id || '';
          } else if (r.position === 2) {
            res.second_candidate_name = r.candidates?.name || '';
            res.second_team_id = r.teams?.id || '';
          } else if (r.position === 3) {
            res.third_candidate_name = r.candidates?.name || '';
            res.third_team_id = r.teams?.id || '';
          }
        }
        return res;
      }
      
      if (method === 'DELETE') {
        // Here `id` is the item_id because we group by item_id
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        const { error } = await supabase.from('results').delete().eq('item_id', id).eq('institution_id', instId);
        if (error) throw error;
        return { success: true };
      }
      if (method === 'PUT') {
        const profile = await ensureAuth();
        const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
        const { error } = await supabase.rpc('update_result', {
          p_institution_id: instId,
          p_item_id: id,
          p_category_id: body.category_id,
          p_first_candidate_name: body.first_candidate_name,
          p_first_team_id: body.first_team_id,
          p_second_candidate_name: body.second_candidate_name,
          p_second_team_id: body.second_team_id,
          p_third_candidate_name: body.third_candidate_name,
          p_third_team_id: body.third_team_id
        });
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
          const { data, error } = await supabase.functions.invoke('admin-operations', {
            body: { action: 'create_institution', payload: body }
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
