-- Create qc_info table
CREATE TABLE IF NOT EXISTS qc_info (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    system_code TEXT REFERENCES systems(code) ON DELETE CASCADE, -- Optional: link to system if needed, default null for global
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE qc_info ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read access" ON qc_info FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert" ON qc_info FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON qc_info FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete" ON qc_info FOR DELETE USING (auth.role() = 'authenticated');

-- Indexes
CREATE UNIQUE INDEX idx_qc_info_code ON qc_info(code);
