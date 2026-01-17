-- Create lots table
create table if not exists public.lots (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  notes text,
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add lot_id to positions if not exists
do $$
begin
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'positions' and column_name = 'lot_id') then
        alter table public.positions add column lot_id uuid references public.lots(id) on delete set null;
    end if;
end $$;

-- Enable RLS
alter table public.lots enable row level security;

-- Add policies for lots (allow all for now)
create policy "Enable read access for all users" on public.lots for select using (true);
create policy "Enable insert access for all users" on public.lots for insert with check (true);
create policy "Enable update access for all users" on public.lots for update using (true);
create policy "Enable delete access for all users" on public.lots for delete using (true);
