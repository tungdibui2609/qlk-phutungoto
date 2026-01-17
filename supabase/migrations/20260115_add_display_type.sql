-- Migration: Add display_type column to zone_layouts table
-- This enables dynamic rendering similar to QLK's hard-coded approach

ALTER TABLE zone_layouts 
ADD COLUMN IF NOT EXISTS display_type TEXT DEFAULT 'auto';

-- Valid values:
-- 'auto'    - Automatic based on level (default)
-- 'header'  - Header only, children below (like NHÀ KHO 1 • NGĂN 1)
-- 'section' - Section with breadcrumb
-- 'grid'    - Direct position grid
-- 'hidden'  - Hide this zone

COMMENT ON COLUMN zone_layouts.display_type IS 'How to render this zone: auto, header, section, grid, hidden';
