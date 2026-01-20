-- Add ref_unit_id to product_units to support hierarchical unit definitions
alter table public.product_units 
add column if not exists ref_unit_id uuid references public.units(id);

-- Check if ref_unit_id exists, if not it will be added. 
-- Existing rows will have null ref_unit_id, implying they reference the Base Unit directly.
