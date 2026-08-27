
DROP TABLE IF EXISTS score_settings CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: institutions
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    public_slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
    public_score_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'institution_admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_name TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: items
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: candidates
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: results
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

    first_candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
    first_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

    second_candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
    second_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

    third_candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
    third_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: score_settings
CREATE TABLE score_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID UNIQUE NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    first_points INTEGER NOT NULL DEFAULT 10,
    second_points INTEGER NOT NULL DEFAULT 6,
    third_points INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS setup
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's institution
CREATE OR REPLACE FUNCTION auth_user_institution_id() RETURNS UUID AS $$
    SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_role() RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Institutions policies
CREATE POLICY "Institutions: Super admin full access" ON institutions
    FOR ALL TO authenticated USING (auth_user_role() = 'super_admin') WITH CHECK (auth_user_role() = 'super_admin');

CREATE POLICY "Institutions: Public read access" ON institutions
    FOR SELECT TO public USING (status = 'active' AND public_score_enabled = true);

CREATE POLICY "Institutions: Institution admin read own" ON institutions
    FOR SELECT TO authenticated USING (id = auth_user_institution_id());

-- Profiles policies
CREATE POLICY "Profiles: Super admin full access" ON profiles
    FOR ALL TO authenticated USING (auth_user_role() = 'super_admin') WITH CHECK (auth_user_role() = 'super_admin');

CREATE POLICY "Profiles: Users read own" ON profiles
    FOR SELECT TO authenticated USING (id = auth.uid());

-- Teams
CREATE POLICY "Teams: tenant isolation" ON teams FOR ALL TO authenticated
    USING (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id())
    WITH CHECK (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id());

CREATE POLICY "Teams: public read" ON teams FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = teams.institution_id AND i.status = 'active' AND i.public_score_enabled = true));

-- Items
CREATE POLICY "Items: tenant isolation" ON items FOR ALL TO authenticated
    USING (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id())
    WITH CHECK (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id());

CREATE POLICY "Items: public read" ON items FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = items.institution_id AND i.status = 'active' AND i.public_score_enabled = true));

-- Candidates
CREATE POLICY "Candidates: tenant isolation" ON candidates FOR ALL TO authenticated
    USING (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id())
    WITH CHECK (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id());

CREATE POLICY "Candidates: public read" ON candidates FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = candidates.institution_id AND i.status = 'active' AND i.public_score_enabled = true));

-- Results
CREATE POLICY "Results: tenant isolation" ON results FOR ALL TO authenticated
    USING (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id())
    WITH CHECK (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id());

CREATE POLICY "Results: public read" ON results FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = results.institution_id AND i.status = 'active' AND i.public_score_enabled = true));

-- Score Settings
CREATE POLICY "Score Settings: tenant isolation" ON score_settings FOR ALL TO authenticated
    USING (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id())
    WITH CHECK (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id());

CREATE POLICY "Score Settings: public read" ON score_settings FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = score_settings.institution_id AND i.status = 'active' AND i.public_score_enabled = true));


-- RPC for atomic result creation
CREATE OR REPLACE FUNCTION create_result(
    p_institution_id UUID,
    p_item_name TEXT,
    p_first_candidate_name TEXT,
    p_first_team_id UUID,
    p_second_candidate_name TEXT,
    p_second_team_id UUID,
    p_third_candidate_name TEXT,
    p_third_team_id UUID
) RETURNS UUID AS $$
DECLARE
    v_item_id UUID;
    v_c1_id UUID;
    v_c2_id UUID;
    v_c3_id UUID;
    v_result_id UUID;
    v_user_role TEXT;
    v_user_inst UUID;
BEGIN
    SELECT auth_user_role(), auth_user_institution_id() INTO v_user_role, v_user_inst;
    
    IF v_user_role != 'super_admin' AND v_user_inst != p_institution_id THEN
        RAISE EXCEPTION 'Not authorized to create result for this institution';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_first_team_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'First team does not belong to institution';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_second_team_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'Second team does not belong to institution';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_third_team_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'Third team does not belong to institution';
    END IF;

    SELECT id INTO v_item_id FROM items WHERE name = p_item_name AND institution_id = p_institution_id;
    IF v_item_id IS NULL THEN
        INSERT INTO items (institution_id, name) VALUES (p_institution_id, p_item_name) RETURNING id INTO v_item_id;
    END IF;

    IF EXISTS (SELECT 1 FROM results WHERE item_id = v_item_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'Result already exists for this item';
    END IF;

    SELECT id INTO v_c1_id FROM candidates WHERE name = p_first_candidate_name AND institution_id = p_institution_id;
    IF v_c1_id IS NULL THEN
        INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_first_candidate_name) RETURNING id INTO v_c1_id;
    END IF;

    SELECT id INTO v_c2_id FROM candidates WHERE name = p_second_candidate_name AND institution_id = p_institution_id;
    IF v_c2_id IS NULL THEN
        INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_second_candidate_name) RETURNING id INTO v_c2_id;
    END IF;

    SELECT id INTO v_c3_id FROM candidates WHERE name = p_third_candidate_name AND institution_id = p_institution_id;
    IF v_c3_id IS NULL THEN
        INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_third_candidate_name) RETURNING id INTO v_c3_id;
    END IF;

    INSERT INTO results (
        institution_id, item_id,
        first_candidate_id, first_team_id,
        second_candidate_id, second_team_id,
        third_candidate_id, third_team_id
    ) VALUES (
        p_institution_id, v_item_id,
        v_c1_id, p_first_team_id,
        v_c2_id, p_second_team_id,
        v_c3_id, p_third_team_id
    ) RETURNING id INTO v_result_id;

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- View for Leaderboard (public and secure)
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    t.institution_id,
    t.id AS team_id,
    t.name AS team_name,
    t.logo_url,
    (SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.first_team_id = t.id) AS first_count,
    (SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.second_team_id = t.id) AS second_count,
    (SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.third_team_id = t.id) AS third_count,
    (
        ((SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.first_team_id = t.id) * COALESCE(s.first_points, 10)) +
        ((SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.second_team_id = t.id) * COALESCE(s.second_points, 6)) +
        ((SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.third_team_id = t.id) * COALESCE(s.third_points, 3))
    ) AS total_points
FROM teams t
LEFT JOIN score_settings s ON s.institution_id = t.institution_id;

-- Ensure Realtime is enabled for results
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE results;
ALTER PUBLICATION supabase_realtime ADD TABLE score_settings;
