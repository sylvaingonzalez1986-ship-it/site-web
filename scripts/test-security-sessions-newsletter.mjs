// In-memory PostgreSQL only. No environment files, credentials, network or emails.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const token = "a".repeat(64), second = "b".repeat(64);
async function query(sql, values = []) { return (await db.query(sql, values)).rows; }
async function service(sql, values = []) {
  await db.exec("set role service_role");
  try { return await query(sql, values); } finally { await db.exec("reset role"); }
}
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${user}');`);
  await db.exec(await readFile("supabase/migrations/20260221000500_newsletter_subscribers.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261110000400_security_admin_sessions.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261110000500_security_newsletter_confirmation.sql", "utf8"));

  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const statement of [
      "select * from public.admin_sessions", "select * from public.newsletter_confirmation_requests",
      `insert into public.admin_sessions values ('${token}','${user}','fingerprint',now())`,
      `select public.rpc_request_newsletter_confirmation('fixture@example.invalid','${token}','test')`,
      `select public.rpc_confirm_newsletter_subscription('${token}')`,
      "select public.rpc_unsubscribe_newsletter('fixture@example.invalid')",
      "select public.rpc_delete_customer_newsletter_data('fixture@example.invalid')",
    ]) await assert.rejects(db.exec(statement), /permission denied/i);
    await db.exec("reset role");
  }
  await service("insert into public.admin_sessions(token_hash,customer_id,credential_fingerprint,expires_at) values ($1,$2,'fixture',now()+interval '1 hour')", [token, user]);
  assert.equal((await service("select * from public.admin_sessions where token_hash=$1", [token])).length, 1);
  await service("delete from public.admin_sessions where customer_id=$1", [user]);
  assert.equal((await service("select * from public.admin_sessions")).length, 0);
  await service("insert into public.admin_sessions(token_hash,customer_id,credential_fingerprint,expires_at) values ($1,$2,'fixture',now())", [token, user]);
  await db.exec(`delete from auth.users where id='${user}'`);
  assert.equal((await query("select * from public.admin_sessions")).length, 0);

  await service("select public.rpc_request_newsletter_confirmation($1,$2,'test')", ["fixture@example.invalid", token]);
  assert.equal((await query("select * from public.newsletter_subscribers")).length, 0, "request alone never activates");
  assert.equal((await service("select public.rpc_confirm_newsletter_subscription($1) as ok", [second]))[0].ok, false);
  assert.equal((await service("select public.rpc_confirm_newsletter_subscription($1) as ok", [token]))[0].ok, true);
  assert.equal((await query("select status from public.newsletter_subscribers"))[0].status, "active");
  assert.equal((await service("select public.rpc_confirm_newsletter_subscription($1) as ok", [token]))[0].ok, false, "single use");
  await service("select public.rpc_request_newsletter_confirmation($1,$2,'test')", ["fixture@example.invalid", token]);
  await service("select public.rpc_request_newsletter_confirmation($1,$2,'test')", ["fixture@example.invalid", second]);
  assert.equal((await service("select public.rpc_confirm_newsletter_subscription($1) as ok", [token]))[0].ok, false, "superseded token rejected");
  await service("select public.rpc_unsubscribe_newsletter($1)", ["fixture@example.invalid"]);
  assert.equal((await service("select public.rpc_confirm_newsletter_subscription($1) as ok", [second]))[0].ok, false, "unsubscribe invalidates pending consent links");
  assert.equal((await query("select status from public.newsletter_subscribers"))[0].status, "unsubscribed");
  await service("select public.rpc_request_newsletter_confirmation($1,$2,'test')", ["fixture@example.invalid", token]);
  await db.exec("update public.newsletter_confirmation_requests set expires_at=now()-interval '1 second'");
  assert.equal((await service("select public.rpc_confirm_newsletter_subscription($1) as ok", [token]))[0].ok, false, "expired token rejected");
  assert.equal((await query("select status from public.newsletter_subscribers"))[0].status, "unsubscribed");
  await service("select public.rpc_request_newsletter_confirmation($1,$2,'test')", ["fixture@example.invalid", second]);
  assert.equal((await service("select public.rpc_confirm_newsletter_subscription($1) as ok", [second]))[0].ok, true, "fresh confirmed resubscription permitted");
  await service("select public.rpc_request_newsletter_confirmation($1,$2,'test')", ["fixture@example.invalid", token]);
  await service("select public.rpc_request_newsletter_confirmation($1,$2,'test')", ["other@example.invalid", "c".repeat(64)]);
  assert.equal((await service("select public.rpc_delete_customer_newsletter_data($1) as deleted", [" FIXTURE@EXAMPLE.INVALID "]))[0].deleted, true);
  assert.equal((await query("select * from public.newsletter_subscribers where email_normalized='fixture@example.invalid'")).length, 0, "erasure removes subscription data");
  assert.equal((await query("select * from public.newsletter_confirmation_requests where email='fixture@example.invalid'")).length, 0, "erasure removes pending email and token");
  assert.equal((await service("select public.rpc_confirm_newsletter_subscription($1) as ok", [token]))[0].ok, false, "old consent token cannot recreate erased subscription");
  assert.equal((await service("select public.rpc_delete_customer_newsletter_data($1) as deleted", ["fixture@example.invalid"]))[0].deleted, false, "erasure is safe to retry");
  assert.equal((await query("select * from public.newsletter_confirmation_requests where email='other@example.invalid'")).length, 1, "other contact's pending consent remains intact");
  await db.exec("set role service_role");
  await assert.rejects(db.exec("select * from public.newsletter_confirmation_requests"), /permission denied/i);
  await db.exec("reset role");
  console.log("PASS: admin session grants/revocation/deletion cascade; newsletter role isolation, explicit consent, expiry, replay, replacement, unsubscribe invalidation and full account-erasure invalidation.");
} finally { await db.close(); }
