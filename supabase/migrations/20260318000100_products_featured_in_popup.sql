alter table public.products
add column if not exists featured_in_popup boolean not null default false;