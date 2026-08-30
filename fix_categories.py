import re

with open('frontend/src/api/client.js', 'r', encoding='utf-8') as f:
    code = f.read()

categories_code = r"""// /categories
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

    // /results"""

code = code.replace('// /results', categories_code)

with open('frontend/src/api/client.js', 'w', encoding='utf-8') as f:
    f.write(code)
