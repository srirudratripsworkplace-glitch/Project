alter table public.special_trips
  add column if not exists original_price numeric(10, 2)
  check (original_price is null or original_price >= 0);
