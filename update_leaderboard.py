import re

with open('frontend/src/api/client.js', 'r', encoding='utf-8') as f:
    code = f.read()

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

with open('frontend/src/api/client.js', 'w', encoding='utf-8') as f:
    f.write(code)
