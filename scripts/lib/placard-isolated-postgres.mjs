import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Explicit opt-in to a dedicated local cluster. The standard fixture stays in PGlite.
export async function openPlacardIsolatedPostgres() {
  const configure = process.env.KQ_TEST_POSTGRES_CLIENT;
  assert(configure, "Set KQ_TEST_POSTGRES_CLIENT to a local postgres.js module");
  const { default: connect } = await import(pathToFileURL(resolve(configure)).href);
  const port = Number(process.env.KQ_TEST_POSTGRES_PORT ?? 55439);
  const options = { host: "127.0.0.1", port, username: "postgres", password: "", ssl: false, max: 1, connect_timeout: 5, onnotice() {} };
  const admin = connect({ ...options, database: "postgres" });
  const database = `kq_audit_${randomUUID().replaceAll("-", "")}`;
  const clusterPath = resolve("output/placard-reliability/postgres/data");
  const opened = [];
  try {
    const [server] = await admin.unsafe("SELECT current_setting('data_directory') AS directory, inet_server_addr()::text AS address");
    assert.equal(resolve(server.directory), clusterPath, "The server must use the dedicated fixture data directory");
    assert.equal(server.address, "127.0.0.1/32");
    await admin.unsafe(`CREATE DATABASE ${database}`);
  } catch (error) {
    await admin.end();
    throw error;
  }
  const open = () => {
    const connection = connect({ ...options, database });
    opened.push(connection);
    return {
      query: async (statement, parameters = []) => ({ rows: Array.from(await connection.unsafe(statement, parameters)) }),
      exec: async statement => {
        // The same dedicated cluster may already contain the fixture roles.
        const sql = statement.replace(/\bCREATE ROLE (anon|authenticated|service_role);/gi,
          (_, role) => `DO $$ BEGIN CREATE ROLE ${role}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
        const result = await connection.unsafe(sql).simple();
        return (Array.isArray(result[0]) ? result : [result]).map(rows => ({ rows: Array.from(rows) }));
      },
    };
  };
  return {
    open,
    close: async () => {
      try {
        await Promise.all(opened.map(connection => connection.end()));
        await admin.unsafe(`DROP DATABASE ${database}`);
      } finally { await admin.end(); }
    },
  };
}
