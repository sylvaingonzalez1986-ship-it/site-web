import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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
    // no local env file
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const year = safeNumber(process.env.INVOICE_CHECK_YEAR, new Date().getFullYear());

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: counterRows, error: counterError } = await supabase
    .from("invoice_counter")
    .select("year,next_sequence")
    .eq("year", year);
  if (counterError) throw new Error(`invoice_counter query failed: ${counterError.message}`);
  const counter = Array.isArray(counterRows) && counterRows[0] ? counterRows[0] : null;

  const { data: invoiceRows, error: invoiceError } = await supabase
    .from("invoices")
    .select("year,sequence,invoice_number")
    .eq("year", year)
    .order("sequence", { ascending: true });
  if (invoiceError) throw new Error(`invoices query failed: ${invoiceError.message}`);

  const sequenceSet = new Set(invoiceRows.map((r) => Number(r.sequence)));
  const maxSequence = invoiceRows.reduce(
    (currentMax, row) => Math.max(currentMax, safeNumber(row.sequence, 0)),
    0,
  );
  const expectedNextSequence = maxSequence + 1;

  const hasSequence1 = sequenceSet.has(1);
  const hasSequence40 = sequenceSet.has(40);
  const seq1Invoice = invoiceRows.find((r) => r.sequence === 1)?.invoice_number;
  const seq40Invoice = invoiceRows.find((r) => r.sequence === 40)?.invoice_number;

  console.log(`Year ${year}`);
  console.log(`Counter row: ${counter ? `${counter.next_sequence}` : "missing"}`);
  console.log(`Invoices count: ${invoiceRows.length}`);
  console.log(`Max sequence: ${maxSequence}`);
  console.log(`Expected next sequence: ${expectedNextSequence}`);
  console.log(`Has sequence 1: ${hasSequence1 ? `yes (${seq1Invoice ?? "missing number"})` : "no"}`);
  console.log(`Has sequence 40: ${hasSequence40 ? `yes (${seq40Invoice ?? "missing number"})` : "no"}`);

  assert(counter && Number(counter.next_sequence) === expectedNextSequence, `Expected invoice_counter.next_sequence=${expectedNextSequence} for year ${year}, got ${counter ? counter.next_sequence : "missing"}`);
  assert(!(hasSequence1 && !hasSequence40), `Invariant violated: invoice sequence 1 exists without sequence 40 migration applied (${year}).`);
  if (hasSequence1) {
    assert(seq1Invoice !== "FA-2026-000040", "Invoice with sequence 1 should not remain FA-2026-000040");
  }
  if (hasSequence40) {
    assert(seq40Invoice === "FA-2026-000040", "Invoice with sequence 40 must be FA-2026-000040.");
  }

  console.log("INVOICE_COUNTER_VALIDATION_OK");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
