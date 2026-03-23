-- Create production_loans table for tracking tools and equipment loans in production
create table if not exists production_loans (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Inventory linkage
  lot_item_id uuid not null, 
  product_id uuid references products(id),
  
  -- Loan details
  worker_name text not null, -- Who borrowed it
  quantity numeric not null,
  unit text not null,
  
  -- Dates
  loan_date timestamp with time zone default now() not null,
  expected_return_date timestamp with time zone,
  return_date timestamp with time zone, -- Actual return date
  
  -- Status
  status text check (status in ('active', 'returned', 'lost')) default 'active',
  
  -- Metadata
  notes text,
  metadata jsonb default '{}'::jsonb,
  system_code text not null
);

-- Enable RLS
alter table production_loans enable row level security;

-- Create policy for authenticated users
drop policy if exists "Enable all access for authenticated users" on production_loans;
create policy "Enable all access for authenticated users" 
on production_loans for all 
using (auth.role() = 'authenticated');
