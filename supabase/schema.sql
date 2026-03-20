-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Workout types enum
create type workout_type as enum ('easy', 'tempo', 'intervals', 'hill', 'long', 'progressive');

-- Workouts table
create table if not exists workouts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  type workout_type not null default 'easy',
  is_public boolean not null default true,
  route_geojson jsonb,
  distance_km numeric(6,2),
  elevation_gain_m numeric(7,1),
  elevation_profile jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Interval types enum
create type interval_type as enum ('work', 'rest', 'warmup', 'cooldown');

-- Intervals table
create table if not exists intervals (
  id uuid default uuid_generate_v4() primary key,
  workout_id uuid references workouts(id) on delete cascade not null,
  type interval_type not null default 'work',
  label text not null,
  duration_seconds integer,
  distance_km numeric(5,2),
  pace_min_per_km numeric(4,2),
  "order" integer not null default 0
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workouts_updated_at
  before update on workouts
  for each row execute function update_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Row Level Security
alter table profiles enable row level security;
alter table workouts enable row level security;
alter table intervals enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Workouts policies
create policy "Public workouts are viewable by everyone"
  on workouts for select using (is_public = true or auth.uid() = user_id);

create policy "Authenticated users can create workouts"
  on workouts for insert with check (auth.uid() = user_id);

create policy "Users can update own workouts"
  on workouts for update using (auth.uid() = user_id);

create policy "Users can delete own workouts"
  on workouts for delete using (auth.uid() = user_id);

-- Intervals policies
create policy "Intervals viewable if workout is viewable"
  on intervals for select using (
    exists (
      select 1 from workouts
      where workouts.id = intervals.workout_id
      and (workouts.is_public = true or workouts.user_id = auth.uid())
    )
  );

create policy "Users can manage intervals of own workouts"
  on intervals for insert with check (
    exists (
      select 1 from workouts
      where workouts.id = intervals.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can update intervals of own workouts"
  on intervals for update using (
    exists (
      select 1 from workouts
      where workouts.id = intervals.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create policy "Users can delete intervals of own workouts"
  on intervals for delete using (
    exists (
      select 1 from workouts
      where workouts.id = intervals.workout_id
      and workouts.user_id = auth.uid()
    )
  );
