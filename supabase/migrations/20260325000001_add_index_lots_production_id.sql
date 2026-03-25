-- Add index for production_id in lots table to speed up searches
CREATE INDEX IF NOT EXISTS lots_production_id_idx ON public.lots(production_id);
