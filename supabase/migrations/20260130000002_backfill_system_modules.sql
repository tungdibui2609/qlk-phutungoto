-- Backfill Basic Modules into Systems table
-- This ensures that basic modules (like 'packaging') are enabled for all existing systems

UPDATE systems
SET modules = (
  SELECT jsonb_agg(DISTINCT e)
  FROM unnest(
    COALESCE(
        CASE 
            WHEN jsonb_typeof(modules) = 'array' THEN (select array_agg(x) from jsonb_array_elements_text(modules) t(x))
            ELSE ARRAY[]::text[] 
        END, 
        ARRAY[]::text[]
    ) || 
    ARRAY['packaging', 'images', 'pricing'] -- Ensure Product Basic Modules are here
  ) AS e
)
WHERE modules IS NULL OR jsonb_typeof(modules) = 'array';
