-- Create site_loans table for tracking tools and equipment loans
create table if not exists site_loans (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Inventory linkage
  lot_item_id uuid not null, -- Intentionally NOT referencing lot_items(id) with FK to allow keeping history even if lot item is deleted/consolidated, OR reference it but set ON DELETE SET NULL. For now, let's just keep the ID.
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
  metadata jsonb default '{}'::jsonb
);

-- Enable RLS (if applicable, but assuming public access for internal tool for now or existing policies cover it)
alter table site_loans enable row level security;

-- Create policy for authenticated users (adjust based on actual auth setup)
drop policy if exists "Enable all access for authenticated users" on site_loans;
create policy "Enable all access for authenticated users" 
on site_loans for all 
using (auth.role() = 'authenticated');
