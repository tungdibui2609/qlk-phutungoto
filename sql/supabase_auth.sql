-- Create a table for public profiles using Supabase Auth
create table profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  full_name text,
  role text default 'staff', -- 'admin', 'staff', 'viewer'
  avatar_url text,
  updated_at timestamp with time zone default now(),
  constraint valid_role check (role in ('admin', 'staff', 'viewer'))
);

-- Enable RLS
alter table profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check ((select auth.uid()) = id);

create policy "Users can update own profile." on profiles
  for update using ((select auth.uid()) = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', 'staff', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
