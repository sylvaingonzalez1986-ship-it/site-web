// Isolated PostgreSQL ACL checks. No credentials, network, or deployed database writes.
// Fixtures preserve relation names, serial sequences and view dependencies, not the
// complete business schema. This does not replace a full Supabase migration replay.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const migrationName = "20260923000200_explicit_data_api_grants.sql";
const migrationDirectory = "supabase/migrations";
const migration = await readFile(path.join(migrationDirectory, migrationName), "utf8");
const historical = await Promise.all((await readdir(migrationDirectory))
  .filter(name => name.endsWith(".sql") && name < migrationName).sort()
  .map(async name => ({ name, sql: await readFile(path.join(migrationDirectory, name), "utf8") })));
const relations = new Map();
for (const { sql } of historical) {
  for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\([\s\S]*?;/gi)) {
    relations.set(match[1], { kind: "table", serial: /\bid\s+(?:BIG|SMALL)?SERIAL\b/i.test(match[0]) });
  }
  for (const match of sql.matchAll(/CREATE(?: OR REPLACE)? VIEW\s+(?:public\.)?(\w+)\b[\s\S]*?;/gi)) {
    relations.set(match[1], { kind: "view", definition: match[0] });
  }
}
for (const relation of relations.values()) {
  if (relation.kind !== "view") continue;
  relation.dependencies = [...new Set([...relation.definition.matchAll(/\b(?:FROM|JOIN)\s+(?:public\.)?(\w+)/gi)]
    .map(match => match[1]).filter(name => relations.has(name)))];
  assert.ok(relation.dependencies.length, "A view fixture must retain its historical relation dependencies");
}

// Derive the required privileges from callers, independently of the GRANT SQL.
const required = new Map();
function requirePrivilege(table, ...privileges) {
  assert.ok(relations.has(table), `Unknown public relation: ${table}`);
  const entry = required.get(table) ?? new Set();
  for (const privilege of privileges) entry.add(privilege);
  required.set(table, entry);
}
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? sourceFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat().filter(file => /\.[cm]?[jt]sx?$/.test(file) && !/\.(?:test|spec|d)\./.test(file));
}
const callers = [...await sourceFiles("src"),
  "scripts/seed-supabase-from-json.mjs",
  "scripts/migrate-customers-to-supabase-auth.mjs",
  "scripts/link-orders-to-supabase-customers.mjs",
  "scripts/restore-lottery-cards-from-docs.mjs",
];
let directCalls = 0;
for (const file of callers) {
  const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "from" && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])) {
      const table = node.arguments[0].text;
      // Storage buckets also use .from(), but are outside this table grant change.
      if (!node.expression.expression.getText(source).includes(".storage")) {
        assert.ok(relations.has(table), `${file}: .from(${table}) has no historical public relation`);
        directCalls += 1;
        let current = node;
        const operations = new Set();
        while (ts.isPropertyAccessExpression(current.parent) && current.parent.expression === current
          && ts.isCallExpression(current.parent.parent)) {
          current = current.parent.parent;
          const operation = current.expression.name.text;
          if (["select", "insert", "update", "delete"].includes(operation)) operations.add(operation.toUpperCase());
          if (operation === "upsert") { operations.add("INSERT"); operations.add("UPDATE"); }
        }
        // Filters and ON CONFLICT updates read columns even without .select().
        if (operations.has("UPDATE") || operations.has("DELETE")) operations.add("SELECT");
        requirePrivilege(table, ...operations);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
// Embedded PostgREST relations can be selected through a shared string constant.
requirePrivilege("lottery_album_page_slots", "SELECT");
requirePrivilege("lottery_album_cards", "SELECT");
requirePrivilege("arena_chanvrier_profiles", "SELECT");
for (const [name, privileges] of required) {
  if (privileges.has("SELECT") && relations.get(name).kind === "view") {
    const pending = [...relations.get(name).dependencies];
    const visited = new Set();
    while (pending.length) {
      const dependency = pending.pop();
      if (visited.has(dependency)) continue;
      visited.add(dependency);
      requirePrivilege(dependency, "SELECT");
      pending.push(...(relations.get(dependency).dependencies ?? []));
    }
  }
}

// Fail closed if the migration starts doing anything besides named additive grants.
const statements = migration.replace(/--[^\n]*/g, "").split(";").map(sql => sql.trim()).filter(Boolean);
for (const statement of statements) assert.match(statement,
  /^(?:BEGIN|COMMIT|GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|USAGE)(?:\s*,\s*(?:SELECT|INSERT|UPDATE|DELETE|USAGE))*\s+ON\s+(?:TABLE|SEQUENCE)\s+public\.\w+(?:\s*,\s*public\.\w+)*\s+TO\s+service_role)$/i,
  `Only explicit grants to service_role are expected: ${statement}`);

const db = new PGlite();
const tables = [...relations].filter(([, relation]) => relation.kind === "table").map(([name]) => name);
const sequences = tables.filter(name => relations.get(name).serial).map(name => `${name}_id_seq`);
const roles = ["anon", "authenticated", "service_role"];
const tablePrivileges = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
const sequencePrivileges = ["SELECT", "UPDATE", "USAGE"];
const key = (kind, name, role, privilege) => `${kind}:${name}:${role}:${privilege}`;
async function privilegeSnapshot() {
  const result = await db.query(`
    SELECT 'table' AS kind, c.relname AS name, r.role, p.privilege,
      has_table_privilege(r.role, c.oid, p.privilege) AS allowed
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest($1::text[]) r(role) CROSS JOIN unnest($2::text[]) p(privilege)
    WHERE n.nspname='public' AND c.relkind IN ('r','v')
    UNION ALL
    SELECT 'sequence', c.relname, r.role, p.privilege,
      has_sequence_privilege(r.role,c.oid,p.privilege)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest($1::text[]) r(role) CROSS JOIN unnest($3::text[]) p(privilege)
    WHERE n.nspname='public' AND c.relkind='S'
  `, [roles, tablePrivileges, sequencePrivileges]);
  return Object.fromEntries(result.rows.map(row => [key(row.kind, row.name, row.role, row.privilege), row.allowed]));
}
async function dataSnapshot() {
  return (await db.query(tables.map(name =>
    `SELECT '${name}' AS relation, jsonb_agg(to_jsonb(t) ORDER BY id)::text AS content FROM public.${name} t`,
  ).join(" UNION ALL ") + " ORDER BY relation")).rows;
}
async function sequenceSnapshot() {
  return (await db.query(sequences.map(name =>
    `SELECT '${name}' AS name,last_value,is_called FROM public.${name}`,
  ).join(" UNION ALL ") + " ORDER BY name")).rows;
}
async function securitySnapshot() {
  return (await db.query(`SELECT jsonb_build_object(
    'functions',(SELECT jsonb_agg(jsonb_build_array(proname,proacl::text,prosecdef) ORDER BY proname)
      FROM pg_proc WHERE pronamespace='public'::regnamespace),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='public'),
    'rls',(SELECT jsonb_agg(jsonb_build_array(relname,relrowsecurity,relforcerowsecurity) ORDER BY relname)
      FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'),
    'defaults',(SELECT jsonb_agg(to_jsonb(a)) FROM pg_default_acl a)
  ) AS snapshot`)).rows[0].snapshot;
}
async function asRole(role, sql) {
  assert.ok(roles.includes(role));
  await db.exec(`BEGIN; SET LOCAL ROLE ${role};`);
  try { return await db.query(sql); } finally { await db.exec("ROLLBACK;"); }
}
async function denied(role, sql) {
  await assert.rejects(() => asRole(role, sql), error => error.code === "42501", `${role} must not execute ${sql}`);
}

try {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  await db.exec(tables.map(name => `CREATE TABLE public.${name} (
    id ${relations.get(name).serial ? "BIGSERIAL" : "BIGINT DEFAULT 1"} PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}');
    ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;
    INSERT INTO public.${name}(id,payload) VALUES(0,'{"fixture":true}');`).join("\n"));
  const pendingViews = new Set([...relations].filter(([, relation]) => relation.kind === "view").map(([name]) => name));
  while (pendingViews.size) {
    let created = 0;
    for (const name of pendingViews) {
      const dependencies = relations.get(name).dependencies;
      if (dependencies.some(dependency => pendingViews.has(dependency))) continue;
      await db.exec(`CREATE VIEW public.${name} WITH (security_invoker=true) AS
        SELECT t0.id,t0.payload FROM ${dependencies.map((dependency, index) => `public.${dependency} t${index}`).join(" CROSS JOIN ")};`);
      pendingViews.delete(name); created += 1;
    }
    assert.ok(created, "Unresolved or cyclic view fixture dependencies");
  }
  // Replay only historical relation ACL statements. The two dynamic relation loops
  // are executed verbatim; all business DDL/data/RPC bodies stay outside this fixture.
  for (const { name, sql } of historical) {
    for (const match of sql.matchAll(/(?:^|\n)\s*(?:GRANT|REVOKE)\s+(?:ALL(?: PRIVILEGES)?|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|USAGE)(?:\s*,\s*\w+)*\s+ON\s+(?!FUNCTION)[\s\S]*?;/gi)) {
      await db.exec(match[0]);
    }
    if (["20260913000100_kq_sales_channels.sql", "20260921000200_kq_treasury_accounting.sql"].includes(name)) {
      const loop = sql.match(/DO \$\$ DECLARE (?:t|name) TEXT; BEGIN[\s\S]*?END \$\$;/);
      assert.ok(loop, `Missing historical permission loop: ${name}`);
      await db.exec(loop[0]);
    }
  }
  // Existing client ACLs and policies must survive unchanged, including customized
  // grants not represented by the fresh-project default-privilege configuration.
  await db.exec(`GRANT SELECT ON public.products TO anon;
    GRANT SELECT,UPDATE ON public.profiles TO authenticated;
    CREATE POLICY fixture_catalog_read ON public.products FOR SELECT TO anon USING(true);
    CREATE POLICY fixture_profile_read ON public.profiles FOR SELECT TO authenticated USING(id=0);
    CREATE FUNCTION public.fixture_rpc_only() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public
      AS 'INSERT INTO kq_culture_token_ledger(id) VALUES(2)';
    REVOKE ALL ON FUNCTION public.fixture_rpc_only() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.fixture_rpc_only() TO service_role;`);
  const before = await privilegeSnapshot();
  const dataBefore = await dataSnapshot();
  const sequencesBefore = await sequenceSnapshot();
  const securityBefore = await securitySnapshot();
  const expected = { ...before };
  for (const [name, privileges] of required) {
    for (const privilege of privileges) expected[key("table", name, "service_role", privilege)] = true;
    if (privileges.has("INSERT") && relations.get(name).serial) {
      expected[key("sequence", `${name}_id_seq`, "service_role", "USAGE")] = true;
    }
  }
  assert.equal(before[key("table", "profiles", "service_role", "SELECT")], false);
  await denied("service_role", "SELECT * FROM public.profiles");
  await db.exec(migration);
  const after = await privilegeSnapshot();
  assert.deepEqual(after, expected, "Privilege delta must match the caller requirements, without widening other ACLs");
  assert.deepEqual(await dataSnapshot(), dataBefore, "Grant migration must preserve every fixture row");
  assert.deepEqual(await sequenceSnapshot(), sequencesBefore, "Grant migration must not advance sequences");
  assert.deepEqual(await securitySnapshot(), securityBefore, "RLS, policies, functions and default privileges must remain unchanged");
  await db.exec(migration);
  assert.deepEqual(await privilegeSnapshot(), after, "Grant migration must be idempotent");
  assert.deepEqual(await dataSnapshot(), dataBefore);

  let checkedOperations = 0;
  for (const [name, privileges] of required) {
    for (const privilege of privileges) {
      const query = {
        SELECT: `SELECT * FROM public.${name}`,
        INSERT: `INSERT INTO public.${name}(payload) VALUES('{"operation":"insert"}')`,
        UPDATE: `UPDATE public.${name} SET payload='{"operation":"update"}' WHERE id=0`,
        DELETE: `DELETE FROM public.${name} WHERE id=0`,
      }[privilege];
      await asRole("service_role", query);
      checkedOperations += 1;
    }
  }
  assert.equal((await asRole("anon", "SELECT * FROM public.products")).rows.length, 1);
  assert.equal((await asRole("authenticated", "SELECT * FROM public.profiles")).rows.length, 1);
  await denied("anon", "SELECT * FROM public.profiles");
  await denied("authenticated", "INSERT INTO public.audit_logs(payload) VALUES('{}')");
  await denied("service_role", "UPDATE public.kq_buddie_rotation SET payload='{}' WHERE id=0");
  await denied("service_role", "INSERT INTO public.kq_treasury_journal(payload) VALUES('{}')");
  await denied("service_role", "INSERT INTO public.kq_culture_token_ledger(payload) VALUES('{}')");
  await asRole("service_role", "SELECT public.fixture_rpc_only()");
  console.log(`Data API grants: ${directCalls} caller chains, ${required.size} relations, ${checkedOperations} real role operations passed; client ACLs, RPC-only restrictions, rows and idempotence preserved.`);
} finally {
  await db.close();
}
