-- Create product_media table
create table if not exists public.product_media (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    product_id uuid references public.products(id) on delete cascade not null,
    url text not null,
    type text not null check (type in ('image', 'video')),
    sort_order integer default 0
);

-- Index for faster queries
create index if not exists product_media_product_id_idx on public.product_media(product_id);

-- RLS Policies (assume basic public read/authenticated write for now to match other tables if they have RLS, or just open)
alter table public.product_media enable row level security;

create policy "Enable read access for all users" on public.product_media
    for select using (true);

create policy "Enable insert for authenticated users only" on public.product_media
    for insert with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users only" on public.product_media
    for update using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users only" on public.product_media
    for delete using (auth.role() = 'authenticated');
