/** Real Auth API against the dedicated disposable instance. No dotenv or remote HTTP. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { installLocalNetworkGuard, REHEARSAL_API } from "./lib/admin-rehearsal-server.mjs";

const project = "admin-access-rehearsal";
const workspace = resolve("output/admin-rehearsal");
const osNames = new Set(["systemroot", "windir", "comspec", "path", "pathext", "temp", "tmp", "userprofile", "appdata", "localappdata", "programfiles", "programfiles(x86)", "programdata", "homedrive", "homepath"]);
const osEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => osNames.has(name.toLowerCase())));
const report = {
  startedAt: new Date().toISOString(), passed: false, apiOrigin: REHEARSAL_API,
  scope: "Real local Supabase Auth recovery, session age, password policy and re-login; not the Next route or UI.",
  isolation: { envFilesLoaded: false, credentialsRecorded: false, externalEmailSent: false, externalRequests: 0 },
  checks: [], cleanup: { accountsRemoved: false },
};
let service, undoNetworkGuard;
const accountIds = [];
let stage = "configuration";
const mark = label => report.checks.push(label);
const checked = (result, label) => { assert(!result.error, label); return result.data; };
const freshPassword = () => randomBytes(16).toString("hex");
const command = (executable, args, input) => execFileSync(executable, args, {
  input, env: osEnv, encoding: "utf8", windowsHide: true, timeout: 30_000, stdio: ["pipe", "pipe", "pipe"],
});
try {
  assert(process.argv.includes("--run"), "Explicit --run required");
  const config = await readFile(resolve(workspace, "supabase/config.toml"), "utf8");
  assert(/^project_id\s*=\s*"admin-access-rehearsal"\s*$/m.test(config));
  assert(/^minimum_password_length\s*=\s*12\s*$/m.test(config));
  assert(/^secure_password_change\s*=\s*true\s*$/m.test(config));
  const status = JSON.parse(command("supabase.exe", ["status", "--workdir", workspace, "-o", "json"]));
  assert.equal(status.API_URL, REHEARSAL_API);
  const dbUrl = new URL(status.DB_URL);
  assert.equal(dbUrl.hostname, "127.0.0.1"); assert.equal(dbUrl.port, "55322");
  const authContainer = JSON.parse(command("docker", ["inspect", `supabase_auth_${project}`]))[0];
  const authEnv = Object.fromEntries(authContainer.Config.Env.map(entry => { const index = entry.indexOf("="); return [entry.slice(0,index), entry.slice(index+1)]; }));
  assert.equal(authEnv.GOTRUE_PASSWORD_MIN_LENGTH, "12");
  assert.equal(authEnv.GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION, "true");
  assert.notEqual(authEnv.GOTRUE_PASSWORD_HIBP_ENABLED, "true");
  assert.notEqual(authEnv.GOTRUE_MAILER_NOTIFICATIONS_PASSWORD_CHANGED_ENABLED, "true");
  report.authImage = authContainer.Config.Image;
  mark("running-local-Auth-has-minimum12-and-secure-password-change");
  undoNetworkGuard = installLocalNetworkGuard(() => { report.isolation.externalRequests++; });
  const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  service = createClient(REHEARSAL_API, status.SECRET_KEY || status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const client = () => createClient(REHEARSAL_API, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `password-rehearsal-${randomBytes(8).toString("hex")}@example.invalid`;
  const oldPassword = randomBytes(4).toString("hex");
  stage = "legacy-fixture";
  // Administrative creation intentionally models an existing account, not public signup.
  const created = checked(await service.auth.admin.createUser({ email, password: oldPassword, email_confirm: true }), "Synthetic legacy account creation failed");
  accountIds.push(created.user.id);
  assert(/^[a-f0-9-]{36}$/i.test(created.user.id));
  const legacy = client();
  const initial = checked(await legacy.auth.signInWithPassword({ email, password: oldPassword }), "Legacy login failed");
  assert.equal(initial.user.id, created.user.id);
  mark("existing-eight-character-password-still-signs-in-with-minimum12");
  const shortUpdate = await legacy.auth.updateUser({ password: randomBytes(5).toString("hex") + "x" });
  assert(shortUpdate.error && shortUpdate.error.code === "weak_password", "An eleven-character new password must be rejected");
  mark("Auth-rejects-eleven-character-new-password");
  stage = "stale-session";
  const sessionId = JSON.parse(Buffer.from(initial.session.access_token.split(".")[1], "base64url").toString("utf8")).session_id;
  assert(/^[a-f0-9-]{36}$/i.test(sessionId));
  // Time travel only for this synthetic session; do not touch server wall time.
  const aged = command("docker", ["exec", "-i", `supabase_db_${project}`, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
    `WITH changed AS (UPDATE auth.sessions SET created_at=now()-interval '25 hours' WHERE id='${sessionId}' AND user_id='${created.user.id}' RETURNING id) SELECT count(*) FROM changed;\n`).trim();
  assert.equal(aged, "1");
  const stale = await legacy.auth.updateUser({ password: freshPassword() });
  assert(stale.error && stale.error.code === "reauthentication_needed", "A stale session must require reauthentication");
  mark("session-aged25hours-cannot-change-password-without-reauthentication");
  stage = "fresh-session";
  const fresh = client();
  checked(await fresh.auth.signInWithPassword({ email, password: oldPassword }), "Fresh sign-in failed");
  const freshValue = randomBytes(6).toString("hex");
  checked(await fresh.auth.updateUser({ password: freshValue }), "Fresh session password change failed");
  checked(await client().auth.signInWithPassword({ email, password: freshValue }), "Fresh password re-login failed");
  const oldLogin = await client().auth.signInWithPassword({ email, password: oldPassword });
  assert(oldLogin.error, "Old password must stop working after change");
  mark("fresh-session-accepts-twelve-character-password-and-relogin-works");
  stage = "recovery";
  const generated = checked(await service.auth.admin.generateLink({ type: "recovery", email }), "Local recovery link generation failed");
  assert(generated.properties.hashed_token);
  const recovery = client();
  checked(await recovery.auth.verifyOtp({ token_hash: generated.properties.hashed_token, type: "recovery" }), "Recovery verification failed");
  const recoveredValue = randomBytes(6).toString("hex");
  checked(await recovery.auth.updateUser({ password: recoveredValue }), "Recovery password change failed");
  checked(await recovery.auth.signOut(), "Recovery logout failed");
  checked(await client().auth.signInWithPassword({ email, password: recoveredValue }), "Recovery re-login failed");
  assert((await client().auth.signInWithPassword({ email, password: freshValue })).error, "Superseded password must be rejected");
  assert((await client().auth.verifyOtp({ token_hash: generated.properties.hashed_token, type: "recovery" })).error, "Used recovery token must be rejected");
  mark("generated-local-recovery-token-changes-password-and-relogin-works");
  mark("previous-password-and-consumed-recovery-token-rejected");
  assert.equal(report.isolation.externalRequests, 0);
  report.passed = true;
} catch {
  report.failedStage = stage;
  process.exitCode = 1;
} finally {
  if (service) {
    const cleanup = await Promise.all(accountIds.map(id => service.auth.admin.deleteUser(id).then(result => !result.error).catch(() => false)));
    report.cleanup.accountsRemoved = cleanup.every(Boolean);
    if (!report.cleanup.accountsRemoved) { report.passed = false; process.exitCode = 1; }
  }
  undoNetworkGuard?.();
  report.finishedAt = new Date().toISOString();
  await mkdir(workspace, { recursive: true });
  await writeFile(resolve(workspace, "auth-password-report.json"), JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failedStage: report.failedStage, accountsRemoved: report.cleanup.accountsRemoved, report: "output/admin-rehearsal/auth-password-report.json" }));
}
