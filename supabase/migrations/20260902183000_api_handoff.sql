-- Add candidate_code to candidates
ALTER TABLE candidates ADD COLUMN candidate_code TEXT UNIQUE;

-- Create registrations table
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES scoring_categories(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'registered',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(candidate_id, item_id)
);

-- Create sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create schedule_slots table
CREATE TABLE schedule_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    showtime TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and setup policies
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Registrations: public read" ON registrations FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = registrations.institution_id AND i.status = 'active'));

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions: public read" ON sessions FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = sessions.institution_id AND i.status = 'active'));

ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schedule slots: public read" ON schedule_slots FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM institutions i WHERE i.id = schedule_slots.institution_id AND i.status = 'active'));

-- Create read-only Integration API view
CREATE OR REPLACE VIEW api_topic_integration AS
SELECT
    r.id AS registration_id,
    c.id AS candidate_id,
    c.candidate_code,
    c.name AS candidate_name,
    t.id AS team_id,
    t.name AS team_name,
    sc.id AS category_id,
    sc.name AS category_name,
    i.id AS program_id,
    i.name AS program_name,
    s.id AS session_id,
    s.name AS session_name,
    ss.id AS schedule_slot_id,
    ss.showtime,
    r.institution_id
FROM registrations r
JOIN candidates c ON r.candidate_id = c.id
JOIN items i ON r.item_id = i.id
JOIN scoring_categories sc ON r.category_id = sc.id
LEFT JOIN teams t ON r.team_id = t.id
LEFT JOIN schedule_slots ss ON ss.registration_id = r.id
LEFT JOIN sessions s ON ss.session_id = s.id;

-- Grant permissions on view
GRANT SELECT ON api_topic_integration TO authenticated;
GRANT SELECT ON api_topic_integration TO anon;

-- Publish tables to realtime if needed
ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_slots;
