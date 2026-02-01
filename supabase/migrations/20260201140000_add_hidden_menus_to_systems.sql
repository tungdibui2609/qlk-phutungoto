-- Migration: Add hidden_menus to systems table
-- Date: 2026-02-01

ALTER TABLE public.systems ADD COLUMN IF NOT EXISTS hidden_menus text[] DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.systems.hidden_menus IS 'List of menu IDs hidden for all users in this warehouse/system.';
