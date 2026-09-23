// Convention check, not a PostgreSQL/RLS validator. New public tables must name
// their API grants in the creating migration. Unqualified names mean public.
// Keep table DDL and grants outside DO/function bodies: dynamic SQL cannot prove
// that a particular table will receive its permissions on a fresh database.
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoles = new Set(["anon", "authenticated", "service_role", "public"]);
const apiPrivileges = new Set(["all", "select", "insert", "update", "delete"]);
const word = (token, value) => token?.kind === "word" && token.value === value;
const identifier = token => token?.kind === "word" || token?.kind === "identifier";

// Preserve strings as opaque tokens, including dollar-quoted PL/pgSQL bodies.
// Nested comments and escaped quotes must never manufacture a CREATE or GRANT.
function tokenize(sql) {
  const tokens = [];
  let offset = 0;
  let line = 1;
  const consume = end => {
    line += (sql.slice(offset, end).match(/\n/g) ?? []).length;
    offset = end;
  };
  while (offset < sql.length) {
    const start = offset;
    const tokenLine = line;
    if (/\s/.test(sql[offset])) { consume(offset + 1); continue; }
    if (sql.startsWith("--", offset)) {
      const end = sql.indexOf("\n", offset);
      consume(end < 0 ? sql.length : end);
      continue;
    }
    if (sql.startsWith("/*", offset)) {
      let depth = 1;
      let end = offset + 2;
      while (end < sql.length && depth) {
        if (sql.startsWith("/*", end)) { depth++; end += 2; }
        else if (sql.startsWith("*/", end)) { depth--; end += 2; }
        else end++;
      }
      if (depth) throw new Error(`line ${line}: unterminated SQL comment`);
      consume(end);
      continue;
    }
    const escaped = /^[eE]'/.test(sql.slice(offset, offset + 2));
    const quote = escaped ? "'" : sql[offset];
    if (quote === "'" || quote === '"') {
      let end = offset + (escaped ? 2 : 1);
      let value = "";
      let closed = false;
      while (end < sql.length) {
        if (escaped && sql[end] === "\\") { value += sql.slice(end, end + 2); end += 2; }
        else if (sql[end] === quote && sql[end + 1] === quote) { value += quote; end += 2; }
        else if (sql[end] === quote) { end++; closed = true; break; }
        else value += sql[end++];
      }
      if (!closed) throw new Error(`line ${line}: unterminated SQL quote`);
      tokens.push({ kind: quote === '"' ? "identifier" : "string", value, line: tokenLine });
      consume(end);
      continue;
    }
    const dollar = /^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/.exec(sql.slice(offset));
    if (dollar) {
      const body = offset + dollar[0].length;
      const end = sql.indexOf(dollar[0], body);
      if (end < 0) throw new Error(`line ${line}: unterminated dollar quote`);
      tokens.push({ kind: "string", value: sql.slice(body, end), line: tokenLine });
      consume(end + dollar[0].length);
      continue;
    }
    const name = /^[A-Za-z_\u0080-\uffff][A-Za-z_0-9$\u0080-\uffff]*/.exec(sql.slice(offset));
    if (name) {
      tokens.push({ kind: "word", value: name[0].toLowerCase(), line: tokenLine });
      consume(offset + name[0].length);
      continue;
    }
    tokens.push({ kind: "symbol", value: sql[offset], line: tokenLine });
    consume(start + 1);
  }
  return tokens;
}

function statements(sql) {
  const result = [];
  let current = [];
  for (const token of tokenize(sql)) {
    if (token.kind === "symbol" && token.value === ";") {
      if (current.length) result.push(current);
      current = [];
    } else current.push(token);
  }
  if (current.length) result.push(current);
  return result;
}

function relation(tokens, start) {
  if (!identifier(tokens[start])) return null;
  let schema = "public";
  let name = tokens[start].value;
  let next = start + 1;
  if (tokens[next]?.value === ".") {
    if (!identifier(tokens[next + 1])) return null;
    schema = name;
    name = tokens[next + 1].value;
    next += 2;
  }
  return { schema, name, key: JSON.stringify([schema, name]), next };
}

function createdTable(tokens) {
  if (!word(tokens[0], "create")) return null;
  let index = 1;
  if (word(tokens[index], "global") || word(tokens[index], "local")) index++;
  if (word(tokens[index], "temp") || word(tokens[index], "temporary")) return null;
  if (word(tokens[index], "unlogged")) index++;
  if (!word(tokens[index++], "table")) return null;
  if (word(tokens[index], "if") && word(tokens[index + 1], "not") && word(tokens[index + 2], "exists")) index += 3;
  return relation(tokens, index);
}

function permission(tokens) {
  const grant = word(tokens[0], "grant");
  if (!grant && !word(tokens[0], "revoke")) return null;
  const on = tokens.findIndex(token => word(token, "on"));
  if (on < 2) return null;
  const privileges = tokens.slice(1, on);
  // Column-level DML is a valid deliberate choice; REFERENCES alone is not API access.
  const relevant = apiPrivileges.has(privileges[0]?.value) && privileges[0]?.kind === "word";
  const all = word(privileges[0], "all") && (privileges.length === 1 ||
    (privileges.length === 2 && word(privileges[1], "privileges")));
  if (grant ? !relevant : !all) return null;
  let index = on + 1;
  if (word(tokens[index], "table")) index++;
  const tables = [];
  while (index < tokens.length) {
    const table = relation(tokens, index);
    if (!table) return null;
    tables.push(table);
    index = table.next;
    if (tokens[index]?.value !== ",") break;
    index++;
  }
  if (!word(tokens[index++], grant ? "to" : "from")) return null;
  const roles = new Set();
  while (identifier(tokens[index])) {
    roles.add(tokens[index++].value);
    if (tokens[index]?.value !== ",") break;
    index++;
  }
  return { grant, tables, roles };
}

function routine(tokens) {
  if (!word(tokens[0], "create")) return false;
  const index = word(tokens[1], "or") && word(tokens[2], "replace") ? 3 : 1;
  return word(tokens[index], "function") || word(tokens[index], "procedure");
}

// Recognize literal table DDL in anonymous blocks, but do not attempt to
// interpret arbitrary EXECUTE expressions. Dynamically constructed DDL requires
// manual review; this guard enforces a convention, not a security boundary.
function unsupportedBlock(tokens) {
  if (!word(tokens[0], "do")) return false;
  const containsTable = inner => inner.some((token, index) => {
    if (word(token, "create") && ["table", "unlogged"].some(value => word(inner[index + 1], value))) return true;
    if (!word(token, "execute")) return false;
    let end = index + 1;
    while (end < inner.length && inner[end].value !== ";") end++;
    return inner.slice(index + 1, end).some(part => part.kind === "string" &&
      /\bcreate\s+(?:unlogged\s+)?table\b/i.test(part.value));
  });
  return tokens.filter(token => token.kind === "string").some(body => containsTable(tokenize(body.value)));
}

export function migrationBaseline(sql) {
  const parsed = statements(sql);
  return {
    tables: [...new Set(parsed.map(createdTable).filter(table => table?.schema === "public").map(table => table.name))].sort(),
  };
}

/**
 * @param {string} sql
 * @param {{ tables: string[] }} [historical]
 */
export function checkMigration(sql, historical = { tables: [] }) {
  const issues = [];
  const tables = new Map();
  const parsed = statements(sql);
  for (const tokens of parsed) {
    if (routine(tokens)) continue;
    if (unsupportedBlock(tokens)) {
      issues.push(`line ${tokens[0].line}: table DDL inside DO blocks cannot be checked; use named static CREATE TABLE and GRANT/REVOKE statements outside the block`);
    }
    const table = createdTable(tokens);
    if (table?.schema === "public" && !historical.tables.includes(table.name)) {
      tables.set(table.key, { ...table, line: tokens[0].line, granted: false, revoked: new Set() });
    }
    const access = permission(tokens);
    if (access) for (const target of access.tables) {
      const created = tables.get(target.key);
      if (!created) continue;
      for (const role of access.roles) {
        if (access.grant && apiRoles.has(role)) created.granted = true;
        else if (!access.grant) created.revoked.add(role);
      }
    }
  }
  for (const table of tables.values()) {
    if (!table.granted && ![...apiRoles].every(role => table.revoked.has(role))) {
      issues.push(`line ${table.line}: public.${JSON.stringify(table.name)} needs an explicit named GRANT to an API role in this migration, or REVOKE ALL from PUBLIC, anon, authenticated, service_role for an intentionally private table; comments, function bodies and dynamic SQL do not count`);
    }
  }
  return issues;
}

export async function checkDirectory(directory, baseline) {
  const issues = [];
  const files = (await readdir(directory)).filter(name => name.endsWith(".sql")).sort();
  for (const file of files) {
    try {
      const historical = Object.hasOwn(baseline, file) ? baseline[file] : undefined;
      const failures = checkMigration(await readFile(resolve(directory, file), "utf8"), historical);
      issues.push(...failures.map(failure => `${file}: ${failure}`));
    } catch (error) {
      issues.push(`${file}: ${error instanceof Error ? error.message : "SQL check failed"}`);
    }
  }
  return { files: files.length, issues };
}

async function main() {
  const baseline = JSON.parse(await readFile(new URL("./lib/supabase-grants-baseline.json", import.meta.url), "utf8"));
  const result = await checkDirectory(fileURLToPath(new URL("../supabase/migrations/", import.meta.url)), baseline.migrations);
  if (result.issues.length) {
    console.error(result.issues.join("\n"));
    process.exitCode = 1;
  } else console.log(`Supabase grants: checked ${result.files} migrations; every new public table has an explicit access decision.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
