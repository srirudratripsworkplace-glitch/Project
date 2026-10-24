alter table public.enquiries
  add column if not exists is_confirmed boolean not null default false,
  add column if not exists confirmed_at timestamptz;
