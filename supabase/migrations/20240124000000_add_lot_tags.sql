
-- Create master_tags table
CREATE TABLE IF NOT EXISTS master_tags (
    name TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT
);

-- Create lot_tags table
CREATE TABLE IF NOT EXISTS lot_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    added_by TEXT,
    UNIQUE(lot_id, tag)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lot_tags_lot_id ON lot_tags(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_tags_tag ON lot_tags(tag);

-- Enable RLS
ALTER TABLE master_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_tags ENABLE ROW LEVEL SECURITY;

-- Simple policy
CREATE POLICY "Enable all access for master_tags" ON master_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for lot_tags" ON lot_tags FOR ALL USING (true) WITH CHECK (true);
