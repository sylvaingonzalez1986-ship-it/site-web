import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const PRODUCT_ANALYSIS_BUCKET = "product-analyses";
const PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX = "/uploads/product-analyses/";

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getPublicUrl(baseUrl, bucket, objectPath) {
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${encodeURIComponent(objectPath).replace(/%2F/g, "/")}`;
}

function extractSupabaseObjectPath(filePath, bucket) {
  try {
    const url = new URL(filePath);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length)) || null;
  } catch {
    return null;
  }
}

function resolveSource(filePath) {
  const supabaseObjectPath = extractSupabaseObjectPath(filePath, PRODUCT_ANALYSIS_BUCKET);
  if (supabaseObjectPath) {
    return { kind: "storage", objectPath: supabaseObjectPath };
  }

  if (filePath.startsWith(PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX)) {
    const objectPath = filePath.slice(PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX.length);
    const localPath = path.join(
      PUBLIC_DIR,
      PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX.replace(/^\//, ""),
      objectPath,
    );
    return { kind: "local", objectPath, localPath };
  }

  try {
    const url = new URL(filePath);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { kind: "remote", url: filePath };
    }
  } catch {
    // ignore
  }

  return { kind: "unsupported" };
}

async function readSourceBytes(supabase, source) {
  if (source.kind === "storage") {
    const download = await supabase.storage
      .from(PRODUCT_ANALYSIS_BUCKET)
      .download(source.objectPath);
    if (download.error) {
      throw new Error(`download ${source.objectPath} failed: ${download.error.message}`);
    }

    return new Uint8Array(await download.data.arrayBuffer());
  }

  if (source.kind === "local") {
    return new Uint8Array(await fs.readFile(source.localPath));
  }

  if (source.kind === "remote") {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`fetch ${source.url} failed: ${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  throw new Error("Unsupported analysis PDF source.");
}

async function importSanitizer() {
  const moduleUrl = new URL("../src/lib/product-analysis-redaction-core.ts", import.meta.url);
  const mod = await import(moduleUrl.href);
  return {
    ProductAnalysisRedactionError: mod.ProductAnalysisRedactionError,
    sanitizeProductAnalysisPdf: mod.sanitizeProductAnalysisPdf,
  };
}

async function main() {
  await loadEnv();

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const dryRun = process.argv.includes("--dry-run");

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { ProductAnalysisRedactionError, sanitizeProductAnalysisPdf } = await importSanitizer();

  const productsResult = await supabase
    .from("products")
    .select("id,name,analysis_pdf")
    .not("analysis_pdf", "is", null)
    .order("id", { ascending: true });

  if (productsResult.error) {
    throw new Error(`select products failed: ${productsResult.error.message}`);
  }

  const rows = (productsResult.data ?? []).filter(
    (row) => typeof row.analysis_pdf === "string" && row.analysis_pdf.trim().length > 0,
  );
  const processedBySource = new Map();
  const updates = [];
  const stats = {
    products: rows.length,
    rewritten: 0,
    updatedRows: 0,
    skippedNoAddress: 0,
    skippedNoText: 0,
    failed: 0,
  };

  for (const row of rows) {
    const currentPath = row.analysis_pdf.trim();

    if (!processedBySource.has(currentPath)) {
      const source = resolveSource(currentPath);

      try {
        if (source.kind === "unsupported") {
          throw new Error("Unsupported analysis PDF source.");
        }

        const originalBytes = await readSourceBytes(supabase, source);
        const sanitized = await sanitizeProductAnalysisPdf(originalBytes);

        if (sanitized.redactionCount === 0) {
          processedBySource.set(currentPath, {
            status: "unchanged",
            nextPath: currentPath,
            detail: "No address block detected.",
          });
          stats.skippedNoAddress += 1;
        } else {
          const objectPath =
            source.kind === "storage" || source.kind === "local"
              ? source.objectPath
              : `${randomUUID()}.pdf`;
          const nextPath = getPublicUrl(supabaseUrl, PRODUCT_ANALYSIS_BUCKET, objectPath);

          if (!dryRun) {
            const upload = await supabase.storage
              .from(PRODUCT_ANALYSIS_BUCKET)
              .upload(objectPath, Buffer.from(sanitized.bytes), {
                contentType: "application/pdf",
                upsert: true,
              });

            if (upload.error) {
              throw new Error(`upload ${objectPath} failed: ${upload.error.message}`);
            }
          }

          processedBySource.set(currentPath, {
            status: "rewritten",
            nextPath,
            detail: `${sanitized.redactionCount} redactions`,
          });
          stats.rewritten += 1;
        }
      } catch (error) {
        if (
          error instanceof ProductAnalysisRedactionError &&
          error.message.includes("texte exploitable")
        ) {
          processedBySource.set(currentPath, {
            status: "skipped-no-text",
            nextPath: currentPath,
            detail: error.message,
          });
          stats.skippedNoText += 1;
        } else {
          processedBySource.set(currentPath, {
            status: "failed",
            nextPath: currentPath,
            detail: error instanceof Error ? error.message : "Unknown error.",
          });
          stats.failed += 1;
        }
      }
    }

    const outcome = processedBySource.get(currentPath);
    if (!outcome) {
      continue;
    }

    if (outcome.status === "rewritten" && outcome.nextPath !== currentPath) {
      updates.push({ id: row.id, analysis_pdf: outcome.nextPath });
    }
  }

  for (const update of updates) {
    if (!dryRun) {
      const result = await supabase
        .from("products")
        .update({ analysis_pdf: update.analysis_pdf })
        .eq("id", update.id);
      if (result.error) {
        throw new Error(`update products.${update.id} failed: ${result.error.message}`);
      }
    }
    stats.updatedRows += 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        ...stats,
        sourcesProcessed: processedBySource.size,
        updates,
        details: Array.from(processedBySource.entries()).map(([sourcePath, outcome]) => ({
          sourcePath,
          ...outcome,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
