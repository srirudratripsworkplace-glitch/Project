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

\ir seed-trips.sql
