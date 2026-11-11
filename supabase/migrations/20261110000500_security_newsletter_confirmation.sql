begin;
-- Only possession of a fresh, single-use email token can activate a subscription.
create table public.newsletter_confirmation_requests (
  email text primary key,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  source text not null,
  expires_at timestamptz not null
);
alter table public.newsletter_confirmation_requests enable row level security;
revoke all on table public.newsletter_confirmation_requests from PUBLIC, anon, authenticated, service_role;

create function public.rpc_request_newsletter_confirmation(p_email text, p_token_hash text, p_source text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_email <> lower(btrim(p_email)) or length(p_email) > 254 or p_email not like '%@%' then
    raise exception 'invalid email';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('newsletter:' || p_email, 0));
  delete from public.newsletter_confirmation_requests where expires_at <= now();
  insert into public.newsletter_confirmation_requests(email, token_hash, source, expires_at)
  values (p_email, p_token_hash, left(p_source, 40), now() + interval '24 hours')
  on conflict (email) do update set token_hash = excluded.token_hash, source = excluded.source, expires_at = excluded.expires_at;
end;
$$;

create function public.rpc_confirm_newsletter_subscription(p_token_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text; v_request public.newsletter_confirmation_requests%rowtype;
begin
  select email into v_email from public.newsletter_confirmation_requests where token_hash = p_token_hash;
  if v_email is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('newsletter:' || v_email, 0));
  delete from public.newsletter_confirmation_requests
  where token_hash = p_token_hash and expires_at > now() returning * into v_request;
  if not found then return false; end if;
  insert into public.newsletter_subscribers(email, email_normalized, status, source)
  values (v_request.email, v_request.email, 'active', v_request.source)
  on conflict (email_normalized) do update set status = 'active', source = excluded.source, updated_at = now();
  return true;
end;
$$;

create function public.rpc_unsubscribe_newsletter(p_email text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text := lower(btrim(p_email));
begin
  perform pg_advisory_xact_lock(hashtextextended('newsletter:' || v_email, 0));
  delete from public.newsletter_confirmation_requests where email = v_email;
  insert into public.newsletter_subscribers(email, email_normalized, status, source)
  values (v_email, v_email, 'unsubscribed', 'mailing')
  on conflict (email_normalized) do update set status = 'unsubscribed', updated_at = now();
end;
$$;

-- Account erasure must invalidate pending consent as well as the subscription.
-- Use the same lock as confirmation: an old link cannot recreate erased data.
create function public.rpc_delete_customer_newsletter_data(p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(p_email));
begin
  if v_email is null or v_email = '' then raise exception 'invalid email'; end if;
  perform pg_advisory_xact_lock(hashtextextended('newsletter:' || v_email, 0));
  delete from public.newsletter_confirmation_requests where email = v_email;
  delete from public.newsletter_subscribers where email_normalized = v_email;
  return found;
end;
$$;

revoke all on function public.rpc_delete_customer_newsletter_data(text) from PUBLIC, anon, authenticated, service_role;
grant execute on function public.rpc_delete_customer_newsletter_data(text) to service_role;
revoke all on function public.rpc_request_newsletter_confirmation(text, text, text) from PUBLIC, anon, authenticated, service_role;
revoke all on function public.rpc_confirm_newsletter_subscription(text) from PUBLIC, anon, authenticated, service_role;
revoke all on function public.rpc_unsubscribe_newsletter(text) from PUBLIC, anon, authenticated, service_role;
grant execute on function public.rpc_request_newsletter_confirmation(text, text, text) to service_role;
grant execute on function public.rpc_confirm_newsletter_subscription(text) to service_role;
grant execute on function public.rpc_unsubscribe_newsletter(text) to service_role;
commit;
