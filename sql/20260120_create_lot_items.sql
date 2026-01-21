create table public.lot_items (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  lot_id uuid references public.lots(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null default 0
);

-- Index for better query performance
create index idx_lot_items_lot_id on public.lot_items(lot_id);
create index idx_lot_items_product_id on public.lot_items(product_id);

-- Optional: Migrate existing data
-- This attempts to move data from lots table to lot_items table for existing records
insert into public.lot_items (lot_id, product_id, quantity, created_at)
select id, product_id, quantity, created_at
from public.lots
where product_id is not null;

-- Make product_id and quantity on lots table nullable (if not already) or just ignore them going forward.
-- Ideally we would drop them, but to be safe we keep them for now.
alter table public.lots alter column product_id drop not null;
alter table public.lots alter column quantity drop not null;
