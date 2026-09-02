-- Make team_id nullable to allow results without assigning points to a specific team
ALTER TABLE results ALTER COLUMN team_id DROP NOT NULL;
