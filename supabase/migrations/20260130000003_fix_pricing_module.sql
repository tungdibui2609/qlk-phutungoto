-- Fix Pricing Module State
-- 1. Remove 'pricing' from systems (Should be OFF by default)
UPDATE systems
SET modules = (
  SELECT jsonb_agg(e)
  FROM jsonb_array_elements_text(modules) e
  WHERE e != 'pricing'
)
WHERE modules @> '["pricing"]';

-- 2. Add 'pricing' to companies (Should be Unlocked/Available to toggle)
UPDATE companies
SET unlocked_modules = (
  SELECT array_agg(DISTINCT e)
  FROM unnest(COALESCE(unlocked_modules, ARRAY[]::text[]) || ARRAY['pricing']) AS e
);
