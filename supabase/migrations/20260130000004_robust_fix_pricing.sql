-- Robustly remove 'pricing' from systems modules
-- Using the minus operator for JSONB arrays

UPDATE systems
SET modules = modules - 'pricing'
WHERE modules @> '["pricing"]';

-- Verify the result (this will output rows if any 'pricing' remains, should be 0)
SELECT count(*) as remaining_count FROM systems WHERE modules @> '["pricing"]';
