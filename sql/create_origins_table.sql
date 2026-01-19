-- Tạo bảng origins
create table public.origins (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  code text, -- Mã quốc gia: VN, JP, US...
  description text,
  is_active boolean default true
);

-- Bật RLS
alter table public.origins enable row level security;

-- Policies
create policy "Enable read access for all users" on public.origins for select using (true);
create policy "Enable insert for authenticated users only" on public.origins for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.origins for update to authenticated using (true);
create policy "Enable delete for authenticated users only" on public.origins for delete to authenticated using (true);
