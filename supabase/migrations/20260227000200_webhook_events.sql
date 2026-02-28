-- Webhook idempotency table: prevents duplicate processing of the same webhook event.
create table if not exists public.webhook_events (
  id           bigint generated always as identity primary key,
  provider     text not null,
  external_id  text not null,
  event_type   text,
  created_at   timestamptz not null default now(),
  constraint uq_webhook_events_provider_external unique (provider, external_id)
);

-- Fast lookups on (provider, external_id) are covered by the unique constraint index.
-- Prune index for old events cleanup.
create index if not exists idx_webhook_events_created_at on public.webhook_events (created_at desc);

-- Deny all client access — service-role only.
alter table public.webhook_events enable row level security;
