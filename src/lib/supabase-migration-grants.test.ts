import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkDirectory, checkMigration, migrationBaseline } from "../../scripts/check-supabase-grants.mjs";

describe("new Supabase table access decisions", () => {
  it("requires each new table to have its own grant in the same migration", () => {
    expect(checkMigration("CREATE TABLE public.one(id int); CREATE TABLE public.two(id int); GRANT SELECT ON public.one TO anon;"))
      .toEqual([expect.stringContaining('public."two"')]);
    expect(checkMigration("CREATE TABLE public.one(id int); GRANT SELECT ON public.other TO service_role;"))
      .toHaveLength(1);
  });

  it("accepts named API grants, lists, column grants and unqualified names", () => {
    expect(checkMigration(`CREATE UNLOGGED TABLE IF NOT EXISTS public.one(id int);
      CREATE TABLE two(id int); GRANT SELECT(id), UPDATE(id) ON TABLE public.one, two TO authenticated, service_role;`)).toEqual([]);
    expect(checkMigration("CREATE TABLE one(id int); GRANT ALL PRIVILEGES ON one TO service_role;")).toEqual([]);
  });

  it("preserves quoted names and case without confusing dots or escaped quotes", () => {
    expect(checkMigration(`CREATE TABLE "public"."One.Table"(id int); GRANT SELECT ON "public"."One.Table" TO "service_role";
      CREATE TABLE "say""hello"(id int); GRANT SELECT ON "say""hello" TO anon;`)).toEqual([]);
    expect(checkMigration('CREATE TABLE "Public".private(id int);')).toEqual([]);
    expect(checkMigration('CREATE TABLE "One"(id int); GRANT SELECT ON one TO anon;')).toHaveLength(1);
  });

  it("accepts explicit privacy only when every API role and PUBLIC is revoked", () => {
    expect(checkMigration("CREATE TABLE secret(id int); REVOKE ALL PRIVILEGES ON TABLE secret FROM PUBLIC, anon, authenticated, service_role;")).toEqual([]);
    expect(checkMigration("CREATE TABLE secret(id int); REVOKE ALL ON secret FROM PUBLIC, anon, authenticated;")).toHaveLength(1);
    expect(checkMigration("CREATE TABLE secret(id int); REVOKE SELECT ON secret FROM PUBLIC, anon, authenticated, service_role;")).toHaveLength(1);
    expect(checkMigration("CREATE TABLE secret(id int); GRANT SELECT ON secret TO postgres;")).toHaveLength(1);
  });

  it("ignores fake SQL in comments, string literals and unexecuted routines", () => {
    expect(checkMigration(`/* CREATE TABLE ghost(id int); /* nested */ */
      SELECT 'CREATE TABLE ghost(id int);', $$CREATE TABLE ghost(id int);$$;
      DO $$ BEGIN RAISE NOTICE 'CREATE TABLE ghost(id int);'; END $$;
      DO $$ BEGIN EXECUTE 'SELECT 1'; END $$;
      CREATE FUNCTION pretend() RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN CREATE TABLE ghost(id int); END $fn$;`)).toEqual([]);
    expect(checkMigration(`CREATE TABLE real(id int);
      -- GRANT SELECT ON real TO anon;
      /* outer /* GRANT SELECT ON real TO anon; */ end */
      SELECT 'GRANT SELECT ON real TO anon;', $body$GRANT SELECT ON real TO anon;$body$;
      CREATE FUNCTION pretend() RETURNS void LANGUAGE plpgsql AS $$ BEGIN GRANT SELECT ON real TO anon; END $$;`)).toHaveLength(1);
    expect(checkMigration(String.raw`CREATE TABLE real(id int); SELECT E'escaped\'quote; GRANT SELECT ON real TO anon;';`)).toHaveLength(1);
  });

  it("does not require API grants for temporary or non-public tables", () => {
    expect(checkMigration(`CREATE TEMP TABLE one(id int); CREATE GLOBAL TEMPORARY TABLE two(id int);
      CREATE TABLE private.three(id int); CREATE TEMP TABLE four AS SELECT 1;`)).toEqual([]);
  });

  it("does not accept schema-wide defaults or grants before the table is created", () => {
    expect(checkMigration("CREATE TABLE one(id int); GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;")).toHaveLength(1);
    expect(checkMigration("ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO anon; CREATE TABLE one(id int);")).toHaveLength(1);
    expect(checkMigration("GRANT SELECT ON one TO anon; CREATE TABLE one(id int);")).toHaveLength(1);
  });

  it("rejects literal procedural creation and does not credit procedural grants", () => {
    expect(checkMigration("DO $$ BEGIN EXECUTE 'CREATE TABLE public.one(id int)'; END $$;"))
      .toEqual([expect.stringContaining("named static CREATE TABLE")]);
    expect(checkMigration("DO $$ BEGIN CREATE TABLE public.one(id int); END $$;"))
      .toEqual([expect.stringContaining("named static CREATE TABLE")]);
    expect(checkMigration("CREATE TABLE one(id int); DO $$ BEGIN GRANT SELECT ON one TO anon; END $$;"))
      .toHaveLength(1);
  });

  it("exempts only known tables in their original historical file", () => {
    const original = "CREATE TABLE old(id int); DO $$ BEGIN EXECUTE 'SELECT 1'; END $$;";
    const baseline = migrationBaseline(original);
    expect(checkMigration(original, baseline)).toEqual([]);
    expect(checkMigration(original + " CREATE TABLE added(id int);", baseline))
      .toEqual([expect.stringContaining('public."added"')]);
    expect(checkMigration(original.replace("SELECT 1", "CREATE TABLE hidden(id int)"), baseline))
      .toEqual([expect.stringContaining("named static CREATE TABLE")]);
  });

  it("checks new filenames even when they are backdated and never shares grants across files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "supabase-grants-"));
    try {
      await writeFile(join(directory, "20200101000000_new.sql"), "CREATE TABLE added(id int);");
      await writeFile(join(directory, "20260923000000_old.sql"), "CREATE TABLE old(id int);");
      await writeFile(join(directory, "20260924000000_grants.sql"), "GRANT SELECT ON added TO anon;");
      const result = await checkDirectory(directory, { "20260923000000_old.sql": { tables: ["old"] } });
      expect(result.files).toBe(3);
      expect(result.issues).toEqual([expect.stringContaining("20200101000000_new.sql")]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("fails closed on malformed comments and strings", () => {
    expect(() => checkMigration("/* unclosed")).toThrow("unterminated");
    expect(() => checkMigration("SELECT $body$unclosed")).toThrow("unterminated");
    expect(() => checkMigration("SELECT 'unclosed")).toThrow("unterminated");
  });
});
