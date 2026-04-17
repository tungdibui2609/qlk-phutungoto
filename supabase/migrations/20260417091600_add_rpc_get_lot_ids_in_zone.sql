-- RPC function: Resolve lot IDs within a zone (and all descendant zones)
-- Replaces expensive client-side resolution that required 3 separate paginated API calls
-- and caused "Bad Request" errors due to URL length limits.

CREATE OR REPLACE FUNCTION get_lot_ids_in_zone(
    p_system_code text,
    p_zone_ids text[]
)
RETURNS TABLE(lot_id uuid) AS $$
    WITH RECURSIVE zone_tree AS (
        -- Base: the provided zone IDs
        SELECT id FROM zones 
        WHERE id = ANY(p_zone_ids::uuid[]) 
          AND system_type = p_system_code
        UNION ALL
        -- Recursive: all descendant zones
        SELECT z.id FROM zones z 
        JOIN zone_tree zt ON z.parent_id = zt.id
        WHERE z.system_type = p_system_code
    )
    SELECT DISTINCT p.lot_id
    FROM positions p
    JOIN zone_positions zp ON zp.position_id = p.id
    WHERE zp.zone_id IN (SELECT id FROM zone_tree)
      AND p.lot_id IS NOT NULL
      AND p.system_type = p_system_code;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_lot_ids_in_zone(text, text[]) TO authenticated;
