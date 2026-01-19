-- Tạo bảng units
create table public.units (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text,
  is_active boolean default true
);

-- Bật RLS (Row Level Security)
alter table public.units enable row level security;

-- Policies
-- Cho phép xem cho mọi người (hoặc giới hạn cho authenticated nếu cần bảo mật hơn)
create policy "Enable read access for all users" on public.units for select using (true);

-- Các quyền ghi chỉ dành cho người dùng đã đăng nhập
create policy "Enable insert for authenticated users only" on public.units for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.units for update to authenticated using (true);
create policy "Enable delete for authenticated users only" on public.units for delete to authenticated using (true);
