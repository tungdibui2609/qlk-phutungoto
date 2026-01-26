create table if not exists public.audit_logs (
    id uuid default gen_random_uuid() primary key,
    table_name text not null,
    record_id text not null, -- Storing as text to support various ID types (uuid, int, etc.)
    action text not null check (action in ('CREATE', 'UPDATE', 'DELETE')),
    old_data jsonb,
    new_data jsonb,
    changed_by uuid references auth.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Policy: Allow authenticated users to insert logs (logging their own actions)
create policy "Users can insert audit logs"
    on public.audit_logs for insert
    to authenticated
    with check (true);

-- Policy: Allow authenticated users to view logs (can be refined later to restrict by role)
create policy "Users can view audit logs"
    on public.audit_logs for select
    to authenticated
    using (true);

-- Index for faster lookups
create index idx_audit_logs_record_id on public.audit_logs(table_name, record_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at);
