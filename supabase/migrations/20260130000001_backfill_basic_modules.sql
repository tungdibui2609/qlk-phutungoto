-- Migration: Backfill Basic Modules
-- Description: Adds 'is_basic' modules to all companies unlocked_modules array if missing.

UPDATE companies
SET unlocked_modules = (
  SELECT array_agg(DISTINCT e)
  FROM unnest(
    COALESCE(unlocked_modules, ARRAY[]::text[]) || 
    ARRAY[
      'images', 'packaging', 
      'inbound_basic', 'outbound_basic', 
      'warehouse_name', 'inbound_date', 
      'stats_overview', 
      'lot_accounting_sync'
    ]
  ) AS e
);
