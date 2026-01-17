-- Migration: Create/Update zone_layouts table for flexible layout configuration
-- Run this in Supabase SQL Editor

-- Drop old table if exists (for clean migration)
DROP TABLE IF EXISTS zone_layouts;

CREATE TABLE zone_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE UNIQUE,
    
    -- Display settings for positions inside this zone
    position_columns INT DEFAULT 8,
    cell_width INT DEFAULT 120,       -- Width in pixels (0 = auto)
    cell_height INT DEFAULT 50,       -- Height in pixels (0 = auto)
    
    -- How to layout child zones: 'vertical' | 'horizontal' | 'grid'
    child_layout TEXT DEFAULT 'vertical',
    
    -- If child_layout is 'grid', how many columns for child zones
    child_columns INT DEFAULT 0,
    
    -- Fixed width for child zones (0 = auto based on content)
    child_width INT DEFAULT 0,
    
    -- Allow collapse/expand
    collapsible BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE zone_layouts ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now)
CREATE POLICY "Allow all for zone_layouts" ON zone_layouts
    FOR ALL USING (true) WITH CHECK (true);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_zone_layouts_zone_id ON zone_layouts(zone_id);
