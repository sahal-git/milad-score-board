-- 1. Drop old views and functions
DROP VIEW IF EXISTS leaderboard CASCADE;
DROP FUNCTION IF EXISTS create_result(UUID, UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS update_result(UUID, UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, UUID);

-- 2. Add new columns to results
ALTER TABLE results ADD COLUMN programme_category TEXT;
ALTER TABLE results ADD COLUMN programme TEXT;
ALTER TABLE results ADD COLUMN candidate_name TEXT;
ALTER TABLE results ADD COLUMN scoring_category_id UUID REFERENCES scoring_categories(id) ON DELETE RESTRICT;

-- 3. Migrate existing data
UPDATE results r
SET 
    programme_category = COALESCE(i.programme_category, 'general'),
    programme = COALESCE(i.name, 'Unknown Programme'),
    candidate_name = (SELECT name FROM candidates c WHERE c.id = r.candidate_id),
    scoring_category_id = r.category_id
FROM items i
WHERE r.item_id = i.id;

-- Ensure any orphaned results without an item_id have a value (shouldn't happen but just in case)
UPDATE results SET programme_category = 'general' WHERE programme_category IS NULL;
UPDATE results SET programme = 'Unknown Programme' WHERE programme IS NULL;
UPDATE results SET scoring_category_id = (SELECT id FROM scoring_categories LIMIT 1) WHERE scoring_category_id IS NULL;

-- 4. Set constraints
ALTER TABLE results 
    ALTER COLUMN programme_category SET NOT NULL,
    ALTER COLUMN programme SET NOT NULL,
    ALTER COLUMN scoring_category_id SET NOT NULL,
    ADD CHECK (programme_category IN ('kiddies', 'sub_junior', 'junior', 'senior', 'super_senior', 'general'));

-- 5. Drop old columns
ALTER TABLE results DROP COLUMN item_id;
ALTER TABLE results DROP COLUMN category_id;
ALTER TABLE results DROP COLUMN candidate_id;

-- 6. Recreate leaderboard view
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
            SELECT r.scoring_category_id AS id, sum(r.points_awarded) as cat_points
            FROM results r
            WHERE r.institution_id = t.institution_id AND r.team_id = t.id
            GROUP BY r.scoring_category_id
        ) cat
    ), '{}'::jsonb) AS category_points,
    COALESCE((
        SELECT jsonb_object_agg(prog.programme_category, prog.cat_points)
        FROM (
            SELECT r.programme_category, sum(r.points_awarded) as cat_points
            FROM results r
            WHERE r.institution_id = t.institution_id AND r.team_id = t.id
            GROUP BY r.programme_category
        ) prog
    ), '{}'::jsonb) AS prog_category_points
FROM teams t;
