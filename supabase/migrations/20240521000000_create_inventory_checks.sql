-- Create inventory_checks table
create table if not exists public.inventory_checks (
    id uuid default gen_random_uuid() primary key,
    code text not null,
    warehouse_id uuid, -- Constraint added later to be safe
    warehouse_name text,
    status text check (status in ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) default 'DRAFT',
    note text,
    created_by uuid, -- Constraint added later
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    completed_at timestamp with time zone,
    system_code text not null
);

-- Ensure Constraints are correct (Self-healing for re-runs)
do $$
begin
    -- Fix warehouse_id FK (Should point to branches)
    if exists (select 1 from information_schema.table_constraints where constraint_name = 'inventory_checks_warehouse_id_fkey') then
        alter table public.inventory_checks drop constraint inventory_checks_warehouse_id_fkey;
    end if;
<<<<<<< HEAD

    alter table public.inventory_checks
        add constraint inventory_checks_warehouse_id_fkey
        foreign key (warehouse_id)
=======

    alter table public.inventory_checks
        add constraint inventory_checks_warehouse_id_fkey
        foreign key (warehouse_id)
>>>>>>> origin/main
        references public.branches(id);

    -- Fix created_by FK (Should point to user_profiles)
    if exists (select 1 from information_schema.table_constraints where constraint_name = 'inventory_checks_created_by_fkey') then
        alter table public.inventory_checks drop constraint inventory_checks_created_by_fkey;
    end if;

<<<<<<< HEAD
    alter table public.inventory_checks
        add constraint inventory_checks_created_by_fkey
        foreign key (created_by)
=======
    alter table public.inventory_checks
        add constraint inventory_checks_created_by_fkey
        foreign key (created_by)
>>>>>>> origin/main
        references public.user_profiles(id);
end $$;


-- Create inventory_check_items table
create table if not exists public.inventory_check_items (
    id uuid default gen_random_uuid() primary key,
    check_id uuid references public.inventory_checks(id) on delete cascade not null,
    lot_id uuid references public.lots(id) not null,
    lot_item_id uuid references public.lot_items(id), -- Nullable if new item found in lot
    product_id uuid references public.products(id) not null,
    system_quantity numeric not null default 0,
    actual_quantity numeric, -- Null means not yet counted
    difference numeric not null default 0,
    unit text,
    note text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.inventory_checks enable row level security;
alter table public.inventory_check_items enable row level security;

-- Policies for inventory_checks
drop policy if exists "Enable all access for authenticated users on inventory_checks" on public.inventory_checks;
create policy "Enable all access for authenticated users on inventory_checks"
    on public.inventory_checks for all
    to authenticated
    using (true)
    with check (true);

-- Policies for inventory_check_items
drop policy if exists "Enable all access for authenticated users on inventory_check_items" on public.inventory_check_items;
create policy "Enable all access for authenticated users on inventory_check_items"
    on public.inventory_check_items for all
    to authenticated
    using (true)
    with check (true);

-- Indexes
create index if not exists idx_inventory_checks_system_code on public.inventory_checks(system_code);
create index if not exists idx_inventory_checks_status on public.inventory_checks(status);
create index if not exists idx_inventory_check_items_check_id on public.inventory_check_items(check_id);
create index if not exists idx_inventory_check_items_lot_id on public.inventory_check_items(lot_id);
