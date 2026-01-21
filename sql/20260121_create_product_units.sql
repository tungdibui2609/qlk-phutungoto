-- Create product_units table for alternative units and conversion rates
create table if not exists public.product_units (
    id uuid default gen_random_uuid() primary key,
    product_id uuid not null references public.products(id) on delete cascade,
    unit_id uuid not null references public.units(id) on delete cascade,
    conversion_rate numeric not null default 1,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Ensure unique unit per product
    unique(product_id, unit_id)
);

-- RLS Policies
alter table public.product_units enable row level security;

create policy "Enable read access for authenticated users" on public.product_units
    for select using (auth.role() = 'authenticated');

create policy "Enable insert access for authenticated users" on public.product_units
    for insert with check (auth.role() = 'authenticated');

create policy "Enable update access for authenticated users" on public.product_units
    for update using (auth.role() = 'authenticated');

create policy "Enable delete access for authenticated users" on public.product_units
    for delete using (auth.role() = 'authenticated');
