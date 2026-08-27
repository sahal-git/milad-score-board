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
        totalPoints: Number(row.total_points)
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
            items (name),
            c1:candidates!first_candidate_id (name),
            t1:teams!first_team_id (name),
            c2:candidates!second_candidate_id (name),
            t2:teams!second_team_id (name),
            c3:candidates!third_candidate_id (name),
            t3:teams!third_team_id (name)
          `)
          .eq('institution_id', instId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        return data.map(r => ({
          id: r.id,
          created_at: r.created_at,
          item_name: r.items.name,
          first_candidate: r.c1?.name,
          first_team: r.t1?.name,
          second_candidate: r.c2?.name,
          second_team: r.t2?.name,
          third_candidate: r.c3?.name,
          third_team: r.t3?.name,
        }));
      }
      
      if (method === 'POST') {
        const { data, error } = await supabase.rpc('create_result', {
          p_institution_id: instId,
          p_item_name: body.item_name,
          p_first_candidate_name: body.first_candidate_name,
          p_first_team_id: body.first_team_id,
          p_second_candidate_name: body.second_candidate_name,
          p_second_team_id: body.second_team_id,
          p_third_candidate_name: body.third_candidate_name,
          p_third_team_id: body.third_team_id
        });
        if (error) throw error;
        return { success: true, id: data };
      }
    }
    
    if (endpoint.startsWith('/results/')) {
      const id = endpoint.split('/')[2];
      if (method === 'DELETE') {
        const { error } = await supabase.from('results').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      }
    }

    // /settings
    if (endpoint === '/settings') {
      const profile = await ensureAuth();
      const instId = profile.role === 'super_admin' ? openInstId : profile.institution_id;
      
      if (method === 'GET') {
        const { data, error } = await supabase.from('score_settings').select('*').eq('institution_id', instId).single();
        if (error) throw error;
        return data;
      }
      
      if (method === 'PUT') {
        const { data, error } = await supabase.from('score_settings').update(body).eq('institution_id', instId).select().single();
        if (error) throw error;
        return data;
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
