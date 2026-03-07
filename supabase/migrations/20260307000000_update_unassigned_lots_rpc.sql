-- Update get_unassigned_lots to handle NULL status
CREATE OR REPLACE FUNCTION get_unassigned_lots(p_system_code TEXT)
RETURNS SETOF lots
LANGUAGE sql
STABLE
AS $$
  SELECT l.*
  FROM lots l
  WHERE l.system_code = p_system_code
    AND (l.status IS NULL OR l.status NOT IN ('exported', 'hidden'))
    AND NOT EXISTS (
      SELECT 1 
      FROM positions p 
      WHERE p.lot_id = l.id
    );
$$;
