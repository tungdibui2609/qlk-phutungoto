-- 1. Create Branches Table
create table if not exists public.branches (
  id uuid default gen_random_uuid() primary key,
  code text not null,
  name text not null,
  address text,
  phone text,
  is_active boolean default true,
  created_at timestamptz default now(),
  constraint branches_code_key unique (code)
);

-- Enable RLS for branches
alter table public.branches enable row level security;

-- Create policies for branches (allow all for authenticated users for now)
create policy "Allow all access to branches for authenticated users"
  on public.branches for all
  to authenticated
  using (true)
  with check (true);


-- 2. Create Company Settings Table
create table if not exists public.company_settings (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  tax_code text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  updated_at timestamptz default now()
);

-- Enable RLS for company_settings
alter table public.company_settings enable row level security;

-- Create policies for company_settings (allow all for authenticated users)
create policy "Allow all access to company_settings for authenticated users"
  on public.company_settings for all
  to authenticated
  using (true)
  with check (true);

-- 3. Insert specific/default company settings row if not exists
-- We enforce single row by logic or constraint, usually just grab the first one
insert into public.company_settings (name, address)
select 'Tên Công Ty', 'Địa chỉ mặc định'
where not exists (select 1 from public.company_settings);
