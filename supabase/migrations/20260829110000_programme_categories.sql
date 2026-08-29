-- 1. Add programme_category to items
ALTER TABLE items ADD COLUMN programme_category TEXT NOT NULL DEFAULT 'general' 
CHECK (programme_category IN ('kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'));

-- 2. Drop the old create_result function since the signature changes
DROP FUNCTION IF EXISTS create_result(UUID, TEXT, UUID, TEXT, UUID, TEXT, UUID, TEXT, UUID);

-- 3. Recreate create_result taking p_item_id instead of p_item_name
CREATE OR REPLACE FUNCTION create_result(
    p_institution_id UUID,
    p_item_id UUID,
    p_category_id UUID,
    p_first_candidate_name TEXT,
    p_first_team_id UUID,
    p_second_candidate_name TEXT,
    p_second_team_id UUID,
    p_third_candidate_name TEXT,
    p_third_team_id UUID
) RETURNS UUID AS $$
DECLARE
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

    IF NOT EXISTS (SELECT 1 FROM items WHERE id = p_item_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'Invalid programme/event';
    END IF;

    SELECT first_points, second_points, third_points INTO v_cat_first, v_cat_second, v_cat_third
    FROM scoring_categories
    WHERE id = p_category_id AND institution_id = p_institution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid scoring category';
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

    IF EXISTS (SELECT 1 FROM results WHERE item_id = p_item_id AND institution_id = p_institution_id) THEN
        RAISE EXCEPTION 'Result already exists for this programme';
    END IF;

    -- Candidate auto-creation remains
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

    RETURN p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Update leaderboard view
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
    ), '{}'::jsonb) AS category_points,
    COALESCE((
        SELECT jsonb_object_agg(prog.programme_category, prog.cat_points)
        FROM (
            SELECT i.programme_category, sum(r.points_awarded) as cat_points
            FROM results r
            JOIN items i ON r.item_id = i.id
            WHERE r.institution_id = t.institution_id AND r.team_id = t.id
            GROUP BY i.programme_category
        ) prog
    ), '{}'::jsonb) AS prog_category_points
FROM teams t;
