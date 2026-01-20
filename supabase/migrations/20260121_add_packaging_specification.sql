-- Add packaging_specification column to products table
alter table public.products add column if not exists packaging_specification text;
