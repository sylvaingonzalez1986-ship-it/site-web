import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

const SCOPES = [
  {
    bucket: "products",
    table: "products",
    fields: ["image", "images"],
  },
  {
    bucket: "producers",
    table: "producers",
    fields: ["image"],
  },
  {
    bucket: "blog",
    table: "blog_posts",
    fields: ["cover_image"],
  },
  {
    bucket: "product-analyses",
    table: "products",
    fields: ["analysis_pdf"],
  },
];

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
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
    // ignore missing env file
  }
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractObjectPathFromUrl(rawValue, bucket) {
  const value = normalizeString(rawValue);
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return null;
    }
    const pathPart = url.pathname.slice(markerIndex + marker.length);
    const decoded = decodeURIComponent(pathPart);
    return decoded || null;
  } catch {
    return null;
  }
}

function collectReferencedObjectPaths(rows, fields, bucket) {
  const referenced = new Set();

  for (const row of rows ?? []) {
    for (const field of fields) {
      const value = row[field];

      if (Array.isArray(value)) {
        for (const item of value) {
          const objectPath = extractObjectPathFromUrl(item, bucket);
          if (objectPath) {
            referenced.add(objectPath);
          }
        }
        continue;
      }

      const objectPath = extractObjectPathFromUrl(value, bucket);
      if (objectPath) {
        referenced.add(objectPath);
      }
    }
  }

  return referenced;
}

async function listAllStorageObjects(supabase, bucket, prefix = "") {
  const objectPaths = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const listResult = await supabase.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
    });

    if (listResult.error) {
      throw new Error(`storage.list ${bucket}/${prefix} failed: ${listResult.error.message}`);
    }

    const entries = listResult.data ?? [];
    if (entries.length === 0) {
      break;
    }

    for (const entry of entries) {
      const entryName = normalizeString(entry.name);
      if (!entryName) {
        continue;
      }

      if (entry.id) {
        objectPaths.push(`${prefix}${entryName}`);
        continue;
      }

      const nested = await listAllStorageObjects(
        supabase,
        bucket,
        `${prefix}${entryName}/`,
      );
      objectPaths.push(...nested);
    }

    if (entries.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return objectPaths;
}

function chunk(values, size) {
  const output = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function isIgnoredObjectPath(objectPath) {
  const normalized = normalizeString(objectPath).toLowerCase();
  return normalized === ".gitkeep" || normalized.endsWith("/.gitkeep");
}

async function cleanupScope({
  supabase,
  bucket,
  table,
  fields,
  applyChanges,
}) {
  const query = await supabase.from(table).select("*");
  if (query.error) {
    throw new Error(`select ${table} failed: ${query.error.message}`);
  }

  const referenced = collectReferencedObjectPaths(query.data, fields, bucket);
  const allObjects = await listAllStorageObjects(supabase, bucket);
  const orphanPaths = allObjects.filter(
    (objectPath) => !referenced.has(objectPath) && !isIgnoredObjectPath(objectPath),
  );

  let deletedCount = 0;
  if (applyChanges && orphanPaths.length > 0) {
    const batches = chunk(orphanPaths, 100);
    for (const batch of batches) {
      const removeResult = await supabase.storage.from(bucket).remove(batch);
      if (removeResult.error) {
        throw new Error(`storage.remove ${bucket} failed: ${removeResult.error.message}`);
      }
      deletedCount += batch.length;
    }
  }

  return {
    bucket,
    totalObjects: allObjects.length,
    referencedObjects: referenced.size,
    orphanObjects: orphanPaths.length,
    deletedObjects: applyChanges ? deletedCount : 0,
    sampleOrphans: orphanPaths.slice(0, 10),
  };
}

async function main() {
  await loadEnv();
  const applyChanges = process.argv.includes("--apply");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summaries = [];
  for (const scope of SCOPES) {
    const summary = await cleanupScope({
      supabase,
      ...scope,
      applyChanges,
    });
    summaries.push(summary);
  }

  console.log(`\nSupabase storage cleanup (${applyChanges ? "APPLY" : "DRY-RUN"})`);
  for (const summary of summaries) {
    console.log(`\n- Bucket: ${summary.bucket}`);
    console.log(`  total: ${summary.totalObjects}`);
    console.log(`  referenced: ${summary.referencedObjects}`);
    console.log(`  orphan: ${summary.orphanObjects}`);
    console.log(`  deleted: ${summary.deletedObjects}`);
    if (summary.sampleOrphans.length > 0) {
      console.log("  sample orphans:");
      for (const orphan of summary.sampleOrphans) {
        console.log(`    - ${orphan}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
