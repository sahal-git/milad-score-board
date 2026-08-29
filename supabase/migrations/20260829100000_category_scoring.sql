-- 1. Create scoring_categories
CREATE TABLE scoring_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    first_points INTEGER NOT NULL DEFAULT 10,
    second_points INTEGER NOT NULL DEFAULT 5,
    third_points INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scoring_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scoring Categories: tenant isolation" ON scoring_categories FOR ALL TO authenticated
    USING (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id())
    WITH CHECK (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id());

CREATE POLICY "Scoring Categories: public read" ON scoring_categories FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = scoring_categories.institution_id AND i.status = 'active' AND i.public_score_enabled = true));

-- Ensure Realtime is enabled for scoring_categories
ALTER PUBLICATION supabase_realtime ADD TABLE scoring_categories;

-- 2. Seed default categories for existing institutions
DO $$
DECLARE
    inst RECORD;
BEGIN
    FOR inst IN SELECT id FROM institutions LOOP
        INSERT INTO scoring_categories (institution_id, name, first_points, second_points, third_points)
        VALUES 
            (inst.id, 'Category A', 10, 5, 3),
            (inst.id, 'Category B', 15, 10, 5),
            (inst.id, 'Category C', 20, 12, 7);
    END LOOP;
END;
$$;

-- 3. Modify results table to be normalized
ALTER TABLE results RENAME TO old_results;

CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES scoring_categories(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL CHECK (position IN (1, 2, 3)),
    candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    points_awarded INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(item_id, position) -- Only one 1st place per event
);

ALTER TABLE results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Results: tenant isolation" ON results FOR ALL TO authenticated
    USING (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id())
    WITH CHECK (auth_user_role() = 'super_admin' OR institution_id = auth_user_institution_id());

CREATE POLICY "Results: public read" ON results FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = results.institution_id AND i.status = 'active' AND i.public_score_enabled = true));

ALTER PUBLICATION supabase_realtime ADD TABLE results;

-- 4. Migrate data
DO $$
DECLARE
    old_row RECORD;
    cat_a_id UUID;
    s_first INTEGER;
    s_second INTEGER;
    s_third INTEGER;
BEGIN
    FOR old_row IN SELECT * FROM old_results LOOP
        -- Get a default category for the institution (Category A)
        SELECT id INTO cat_a_id FROM scoring_categories WHERE institution_id = old_row.institution_id AND name = 'Category A' LIMIT 1;
        
        -- Get old points if available
        SELECT first_points, second_points, third_points INTO s_first, s_second, s_third
        FROM score_settings WHERE institution_id = old_row.institution_id;
        
        IF s_first IS NULL THEN s_first := 10; s_second := 6; s_third := 3; END IF;

        IF old_row.first_team_id IS NOT NULL THEN
            INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded, created_at)
            VALUES (old_row.institution_id, old_row.item_id, cat_a_id, 1, old_row.first_candidate_id, old_row.first_team_id, s_first, old_row.created_at);
        END IF;

        IF old_row.second_team_id IS NOT NULL THEN
            INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded, created_at)
            VALUES (old_row.institution_id, old_row.item_id, cat_a_id, 2, old_row.second_candidate_id, old_row.second_team_id, s_second, old_row.created_at);
        END IF;

        IF old_row.third_team_id IS NOT NULL THEN
            INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded, created_at)
            VALUES (old_row.institution_id, old_row.item_id, cat_a_id, 3, old_row.third_candidate_id, old_row.third_team_id, s_third, old_row.created_at);
        END IF;
    END LOOP;
END;
$$;

DROP TABLE old_results;
DROP TABLE score_settings;

-- 5. Recreate create_result RPC
CREATE OR REPLACE FUNCTION create_result(
    p_institution_id UUID,
    p_item_name TEXT,
    p_category_id UUID,
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
    v_user_role TEXT;
    v_user_inst UUID;
    v_cat_first INT;
    v_cat_second INT;
    v_cat_third INT;
BEGIN
    SELECT auth_user_role(), auth_user_institution_id() INTO v_user_role, v_user_inst;
    
    IF v_user_role != 'super_admin' AND v_user_inst != p_institution_id THEN
        RAISE EXCEPTION 'Not authorized to create result for this institution';
    END IF;

    SELECT first_points, second_points, third_points INTO v_cat_first, v_cat_second, v_cat_third
    FROM scoring_categories
    WHERE id = p_category_id AND institution_id = p_institution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid category';
    END IF;

    IF p_first_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id = p_first_team_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'First team does not belong to institution';
    END IF;
    IF p_second_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id = p_second_team_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'Second team does not belong to institution';
    END IF;
    IF p_third_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id = p_third_team_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'Third team does not belong to institution';
    END IF;

    SELECT id INTO v_item_id FROM items WHERE name = p_item_name AND institution_id = p_institution_id;
    IF v_item_id IS NULL THEN
        INSERT INTO items (institution_id, name) VALUES (p_institution_id, p_item_name) RETURNING id INTO v_item_id;
    END IF;

    IF EXISTS (SELECT 1 FROM results WHERE item_id = v_item_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'Result already exists for this item';
    END IF;

    IF p_first_candidate_name IS NOT NULL AND p_first_candidate_name != '' THEN
        SELECT id INTO v_c1_id FROM candidates WHERE name = p_first_candidate_name AND institution_id = p_institution_id;
        IF v_c1_id IS NULL THEN
            INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_first_candidate_name) RETURNING id INTO v_c1_id;
        END IF;
    END IF;

    IF p_second_candidate_name IS NOT NULL AND p_second_candidate_name != '' THEN
        SELECT id INTO v_c2_id FROM candidates WHERE name = p_second_candidate_name AND institution_id = p_institution_id;
        IF v_c2_id IS NULL THEN
            INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_second_candidate_name) RETURNING id INTO v_c2_id;
        END IF;
    END IF;

    IF p_third_candidate_name IS NOT NULL AND p_third_candidate_name != '' THEN
        SELECT id INTO v_c3_id FROM candidates WHERE name = p_third_candidate_name AND institution_id = p_institution_id;
        IF v_c3_id IS NULL THEN
            INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_third_candidate_name) RETURNING id INTO v_c3_id;
        END IF;
    END IF;

    IF p_first_team_id IS NOT NULL THEN
        INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded)
        VALUES (p_institution_id, v_item_id, p_category_id, 1, v_c1_id, p_first_team_id, v_cat_first);
    END IF;

    IF p_second_team_id IS NOT NULL THEN
        INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded)
        VALUES (p_institution_id, v_item_id, p_category_id, 2, v_c2_id, p_second_team_id, v_cat_second);
    END IF;

    IF p_third_team_id IS NOT NULL THEN
        INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded)
        VALUES (p_institution_id, v_item_id, p_category_id, 3, v_c3_id, p_third_team_id, v_cat_third);
    END IF;

    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add update_result RPC for editing an entire event's result
CREATE OR REPLACE FUNCTION update_result(
    p_institution_id UUID,
    p_item_id UUID,
    p_category_id UUID,
    p_first_candidate_name TEXT,
    p_first_team_id UUID,
    p_second_candidate_name TEXT,
    p_second_team_id UUID,
    p_third_candidate_name TEXT,
    p_third_team_id UUID
) RETURNS VOID AS $$
DECLARE
    v_user_role TEXT;
    v_user_inst UUID;
    v_cat_first INT;
    v_cat_second INT;
    v_cat_third INT;
    v_c1_id UUID;
    v_c2_id UUID;
    v_c3_id UUID;
BEGIN
    SELECT auth_user_role(), auth_user_institution_id() INTO v_user_role, v_user_inst;
    
    IF v_user_role != 'super_admin' AND v_user_inst != p_institution_id THEN
        RAISE EXCEPTION 'Not authorized to update result for this institution';
    END IF;

    SELECT first_points, second_points, third_points INTO v_cat_first, v_cat_second, v_cat_third
    FROM scoring_categories
    WHERE id = p_category_id AND institution_id = p_institution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid category';
    END IF;

    DELETE FROM results WHERE item_id = p_item_id AND institution_id = p_institution_id;

    IF p_first_candidate_name IS NOT NULL AND p_first_candidate_name != '' THEN
        SELECT id INTO v_c1_id FROM candidates WHERE name = p_first_candidate_name AND institution_id = p_institution_id;
        IF v_c1_id IS NULL THEN
            INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_first_candidate_name) RETURNING id INTO v_c1_id;
        END IF;
    END IF;

    IF p_second_candidate_name IS NOT NULL AND p_second_candidate_name != '' THEN
        SELECT id INTO v_c2_id FROM candidates WHERE name = p_second_candidate_name AND institution_id = p_institution_id;
        IF v_c2_id IS NULL THEN
            INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_second_candidate_name) RETURNING id INTO v_c2_id;
        END IF;
    END IF;

    IF p_third_candidate_name IS NOT NULL AND p_third_candidate_name != '' THEN
        SELECT id INTO v_c3_id FROM candidates WHERE name = p_third_candidate_name AND institution_id = p_institution_id;
        IF v_c3_id IS NULL THEN
            INSERT INTO candidates (institution_id, name) VALUES (p_institution_id, p_third_candidate_name) RETURNING id INTO v_c3_id;
        END IF;
    END IF;

    IF p_first_team_id IS NOT NULL THEN
        INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded)
        VALUES (p_institution_id, p_item_id, p_category_id, 1, v_c1_id, p_first_team_id, v_cat_first);
    END IF;

    IF p_second_team_id IS NOT NULL THEN
        INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded)
        VALUES (p_institution_id, p_item_id, p_category_id, 2, v_c2_id, p_second_team_id, v_cat_second);
    END IF;

    IF p_third_team_id IS NOT NULL THEN
        INSERT INTO results (institution_id, item_id, category_id, position, candidate_id, team_id, points_awarded)
        VALUES (p_institution_id, p_item_id, p_category_id, 3, v_c3_id, p_third_team_id, v_cat_third);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update leaderboard view
DROP VIEW IF EXISTS leaderboard;
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    t.institution_id,
    t.id AS team_id,
    t.name AS team_name,
    t.logo_url,
    (SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.team_id = t.id AND r.position = 1) AS first_count,
    (SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.team_id = t.id AND r.position = 2) AS second_count,
    (SELECT count(*) FROM results r WHERE r.institution_id = t.institution_id AND r.team_id = t.id AND r.position = 3) AS third_count,
    COALESCE((SELECT sum(points_awarded) FROM results r WHERE r.institution_id = t.institution_id AND r.team_id = t.id), 0) AS total_points,
    COALESCE((
        SELECT jsonb_object_agg(cat.id, cat_points)
        FROM (
            SELECT r.category_id AS id, sum(r.points_awarded) as cat_points
            FROM results r
            WHERE r.institution_id = t.institution_id AND r.team_id = t.id
            GROUP BY r.category_id
        ) cat
    ), '{}'::jsonb) AS category_points
FROM teams t;
