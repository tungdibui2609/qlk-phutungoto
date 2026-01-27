-- Loosen coupling between inventory_check_items and lots
alter table public.inventory_check_items
    drop constraint if exists inventory_check_items_lot_id_fkey,
    drop constraint if exists inventory_check_items_lot_item_id_fkey;

-- Make lot references nullable (if not already) and add snapshot columns
alter table public.inventory_check_items
    alter column lot_id drop not null,
    alter column lot_item_id drop not null,
    add column if not exists lot_code text,
    add column if not exists product_sku text,
    add column if not exists product_name text;
