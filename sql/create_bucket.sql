-- 1. Create the 'company-assets' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do nothing;

-- 2. Policies for 'company-assets'
create policy "Public Access Company Assets"
on storage.objects for select
using ( bucket_id = 'company-assets' );

create policy "Authenticated Upload Company Assets"
on storage.objects for insert
with check ( bucket_id = 'company-assets' and auth.role() = 'authenticated' );

create policy "Authenticated Update Company Assets"
on storage.objects for update
using ( bucket_id = 'company-assets' and auth.role() = 'authenticated' );

create policy "Authenticated Delete Company Assets"
on storage.objects for delete
using ( bucket_id = 'company-assets' and auth.role() = 'authenticated' );
