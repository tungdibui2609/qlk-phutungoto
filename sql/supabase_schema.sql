-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. CATEGORIES (Danh mục phụ tùng)
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique,
  description text,
  created_at timestamp with time zone default now()
);

-- 2. PRODUCTS (Sản phẩm / Phụ tùng)
create table products (
  id uuid default uuid_generate_v4() primary key,
  sku text unique not null,
  name text not null,
  category_id uuid references categories(id),
  manufacturer text,
  part_number text, -- Mã OEM
  compatible_models text[], -- Mảng các text, ví dụ: {'Ford Ranger 2020', 'Toyota Hilux'}
  unit text default 'cái',
  min_stock_level int default 10,
  image_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. WAREHOUSES (Kho)
create table warehouses (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  name text not null,
  address text,
  created_at timestamp with time zone default now()
);

-- 4. LOCATIONS (Vị trí kệ/kho)
create table locations (
  id uuid default uuid_generate_v4() primary key,
  warehouse_id uuid references warehouses(id) on delete cascade,
  code text not null, -- Ví dụ: A-01-02
  type text default 'Rack', -- Rack, Floor, Shelf...
  created_at timestamp with time zone default now(),
  unique(warehouse_id, code)
);

-- 5. INVENTORY (Tồn kho)
create table inventory (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete restrict,
  location_id uuid references locations(id) on delete restrict,
  quantity int not null default 0,
  status text default 'Available',
  updated_at timestamp with time zone default now(),
  unique(product_id, location_id)
);

-- 6. TRANSACTIONS (Lịch sử nhập xuất)
create table inventory_transactions (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id),
  from_location_id uuid references locations(id),
  to_location_id uuid references locations(id),
  quantity int not null,
  type text not null, -- IMPORT, EXPORT, MOVE, ADJUST
  notes text,
  created_at timestamp with time zone default now(),
  created_by uuid -- Sẽ link với bảng auth.users
);

-- RLS POLICIES (Bảo mật cơ bản - Cho phép đọc/ghi công khai để test, sau này sẽ chặn lại)
alter table categories enable row level security;
alter table products enable row level security;
alter table warehouses enable row level security;
alter table locations enable row level security;
alter table inventory enable row level security;
alter table inventory_transactions enable row level security;

-- Policy cho phép mọi người xem và sửa (Dùng cho giai đoạn phát triển)
create policy "Enable access for all users" on categories for all using (true) with check (true);
create policy "Enable access for all users" on products for all using (true) with check (true);
create policy "Enable access for all users" on warehouses for all using (true) with check (true);
create policy "Enable access for all users" on locations for all using (true) with check (true);
create policy "Enable access for all users" on inventory for all using (true) with check (true);
create policy "Enable access for all users" on inventory_transactions for all using (true) with check (true);
