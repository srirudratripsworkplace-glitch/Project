create extension if not exists pgcrypto;

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

alter table public.manual_trip_notes enable row level security;

drop policy if exists "Administrators manage manual trip notes" on public.manual_trip_notes;
create policy "Administrators manage manual trip notes"
  on public.manual_trip_notes for all to authenticated
  using (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (auth.uid() is not null and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all on public.manual_trip_notes from public, anon, authenticated;
grant select, insert, update, delete on public.manual_trip_notes to authenticated;
