-- 1. Create the 'products' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- 2. Enable RLS (Should be on by default for storage.objects, but ensuring policies are set)

-- Policy: Anyone can View/Download images (Public)
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'products' );

-- Policy: Only Authenticated users can Upload
create policy "Authenticated Upload"
on storage.objects for insert
with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

-- Policy: Only Authenticated users can Update/Delete
create policy "Authenticated Update"
on storage.objects for update
using ( bucket_id = 'products' and auth.role() = 'authenticated' );

create policy "Authenticated Delete"
on storage.objects for delete
using ( bucket_id = 'products' and auth.role() = 'authenticated' );
