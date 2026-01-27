-- Create operational_notes table
create table if not exists public.operational_notes (
    id uuid default gen_random_uuid() primary key,
    content text not null,
    user_id uuid not null references public.user_profiles(id),
    parent_id uuid references public.operational_notes(id),
    images text[] default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Enable RLS
alter table public.operational_notes enable row level security;

-- Policies
create policy "Enable read access for all users"
    on public.operational_notes for select
    using (true);

create policy "Enable insert for authenticated users"
    on public.operational_notes for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "Enable update for own notes"
    on public.operational_notes for update
    to authenticated
    using (auth.uid() = user_id);

create policy "Enable delete for own notes"
    on public.operational_notes for delete
    to authenticated
    using (auth.uid() = user_id);

-- Storage Bucket
insert into storage.buckets (id, name, public)
values ('note-attachments', 'note-attachments', true)
on conflict (id) do nothing;

-- Storage Policies
-- We need to drop existing policies if we are re-running or if there's a conflict, but since policies have unique names usually per table/bucket, we should be careful.
-- However, creating policies with 'if not exists' is not directly supported in standard SQL for policies, usually we do DO block or drop if exists.
-- For simplicity in this environment, I'll wrap in a DO block to prevent errors if they exist.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access to Note Attachments'
    ) THEN
        create policy "Public Access to Note Attachments"
            on storage.objects for select
            using ( bucket_id = 'note-attachments' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload note attachments'
    ) THEN
        create policy "Authenticated users can upload note attachments"
            on storage.objects for insert
            to authenticated
            with check ( bucket_id = 'note-attachments' );
    END IF;
END
$$;
