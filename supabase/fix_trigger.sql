-- Fix: make handle_new_user trigger robust against duplicates and RLS
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Ensure the trigger exists (recreate if needed)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Add INSERT policy so service_role / trigger can insert profiles
drop policy if exists "Service role can insert profiles" on profiles;
create policy "Service role can insert profiles"
  on profiles for insert with check (true);
