-- Persistent revocation and identity binding for administrator elevation.
begin;
create table public.admin_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  customer_id uuid not null references auth.users(id) on delete cascade,
  credential_fingerprint text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index admin_sessions_customer_id_idx on public.admin_sessions(customer_id);
alter table public.admin_sessions enable row level security;
revoke all on table public.admin_sessions from PUBLIC, anon, authenticated, service_role;
grant select, insert, delete on table public.admin_sessions to service_role;
commit;
