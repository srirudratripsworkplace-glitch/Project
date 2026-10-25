create extension if not exists pgcrypto;

create table if not exists public.trip_categories (
  id text primary key,
  title text not null,
  subtitle text default '',
  tagline text default '',
  image text default '',
  icon_name text default 'map',
  accent_color text default '#0b5960',
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.destinations (
  id text primary key,
  category_id text not null references public.trip_categories(id) on delete cascade,
  name text not null,
  image text default '',
  short_description text default '',
  overview text default '',
  duration text default '',
  places_to_visit text[] default '{}',
  highlights text[] default '{}',
  extra_info text default '',
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  destination text not null,
  travellers text,
  travel_date date,
  message text,
  is_confirmed boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trip text not null default '',
  review text not null,
  image text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.special_trips (
  id text primary key,
  title text not null,
  description text not null default '',
  image text not null default '',
  from_location text not null default '',
  destination text not null,
  trip_date date,
  trip_time time,
  price numeric(10, 2) check (price is null or price >= 0),
  seats integer check (seats is null or seats >= 0),
  badge text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manual_trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null,
  customer_name text not null,
  destination text not null,
  reached_location text not null default '',
  reached_date date,
  amount numeric(10, 2) check (amount is null or amount >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_categories enable row level security;
alter table public.destinations enable row level security;
alter table public.enquiries enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.special_trips enable row level security;
alter table public.manual_trip_notes enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('trip_categories', 'destinations', 'enquiries', 'customer_reviews', 'special_trips', 'manual_trip_notes')
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end
$$;

create policy "Public can read active trip categories"
  on public.trip_categories for select to anon, authenticated
  using (is_active = true);
create policy "Administrators manage trip categories"
  on public.trip_categories for all to authenticated
  using (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read active destinations"
  on public.destinations for select to anon, authenticated
  using (is_active = true);
create policy "Administrators manage destinations"
  on public.destinations for all to authenticated
  using (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read active special trips"
  on public.special_trips for select to anon, authenticated
  using (is_active = true);
create policy "Administrators manage special trips"
  on public.special_trips for all to authenticated
  using (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can create enquiries"
  on public.enquiries for insert to anon, authenticated
  with check (
    char_length(trim(name)) between 1 and 120
    and phone ~ '^\+(1|27|44|61|64|65|91|353|971)[0-9]{10}$'
    and char_length(trim(destination)) between 1 and 160
    and (email is null or (char_length(trim(email)) between 3 and 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    and travellers ~ '^[1-6]$'
    and (travel_date is null or travel_date >= current_date)
    and (message is null or char_length(message) <= 2000)
  );
create policy "Administrators read enquiries"
  on public.enquiries for select to authenticated
  using (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read active customer reviews"
  on public.customer_reviews for select to anon, authenticated
  using (is_active = true);
create policy "Administrators manage customer reviews"
  on public.customer_reviews for all to authenticated
  using (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Administrators manage manual trip notes"
  on public.manual_trip_notes for all to authenticated
  using (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all on public.trip_categories, public.destinations, public.enquiries,
  public.customer_reviews, public.special_trips, public.manual_trip_notes from public, anon, authenticated;
grant select on public.trip_categories, public.destinations, public.customer_reviews,
  public.special_trips to anon, authenticated;
grant insert on public.enquiries to anon, authenticated;
grant select, insert, update, delete on public.trip_categories, public.destinations,
  public.customer_reviews, public.special_trips, public.manual_trip_notes to authenticated;
grant select on public.enquiries to authenticated;
