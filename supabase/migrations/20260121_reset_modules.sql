-- Reset modules for all systems to empty array (or just basic_info if needed, but the code handles empty)
update public.systems set modules = '["basic_info"]'::jsonb;
