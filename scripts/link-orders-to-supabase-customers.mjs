import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      result[key] = value;
    }
  }
  return result;
}

async function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  try {
    const content = await fs.readFile(envPath, "utf8");
    const parsed = parseEnv(content);
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const users = await listAllUsers(supabase);
  const userIdByEmail = new Map();
  for (const user of users) {
    const email = (user.email ?? "").trim().toLowerCase();
    if (!email || !user.id) continue;
    userIdByEmail.set(email, user.id);
  }

  const ordersResult = await supabase
    .from("orders")
    .select("id, customer_id, customer_email")
    .is("customer_id", null)
    .not("customer_email", "is", null);

  if (ordersResult.error) {
    throw new Error(`select orders failed: ${ordersResult.error.message}`);
  }

  let linked = 0;
  for (const order of ordersResult.data ?? []) {
    const email = String(order.customer_email ?? "").trim().toLowerCase();
    if (!email) continue;
    const userId = userIdByEmail.get(email);
    if (!userId) continue;

    const update = await supabase
      .from("orders")
      .update({ customer_id: userId })
      .eq("id", order.id);
    if (update.error) {
      throw new Error(`update order ${order.id} failed: ${update.error.message}`);
    }
    linked += 1;
  }

  console.log(`Order linkage completed. linked=${linked}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
