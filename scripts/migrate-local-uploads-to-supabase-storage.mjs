import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");

const CONFIG = [
  {
    bucket: "products",
    prefix: "/uploads/products/",
    localDir: path.join(PUBLIC_DIR, "uploads", "products"),
    table: "products",
    singleField: "image",
    arrayField: "images",
  },
  {
    bucket: "producers",
    prefix: "/uploads/producers/",
    localDir: path.join(PUBLIC_DIR, "uploads", "producers"),
    table: "producers",
    singleField: "image",
    arrayField: null,
  },
  {
    bucket: "blog",
    prefix: "/uploads/blog/",
    localDir: path.join(PUBLIC_DIR, "uploads", "blog"),
    table: "blog_posts",
    singleField: "cover_image",
    arrayField: null,
  },
  {
    bucket: "product-analyses",
    prefix: "/uploads/product-analyses/",
    localDir: path.join(PUBLIC_DIR, "uploads", "product-analyses"),
    table: "products",
    singleField: "analysis_pdf",
    arrayField: null,
  },
];

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

async function listFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function getPublicUrl(baseUrl, bucket, objectPath) {
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${encodeURIComponent(objectPath).replace(/%2F/g, "/")}`;
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

  for (const scope of CONFIG) {
    const fileNames = await listFiles(scope.localDir);
    const fileSet = new Set(fileNames);

    for (const fileName of fileNames) {
      const localPath = path.join(scope.localDir, fileName);
      const buffer = await fs.readFile(localPath);
      const contentType = fileName.endsWith(".png")
        ? "image/png"
        : fileName.endsWith(".webp")
          ? "image/webp"
          : fileName.endsWith(".pdf")
            ? "application/pdf"
            : "image/jpeg";

      const upload = await supabase.storage
        .from(scope.bucket)
        .upload(fileName, buffer, { contentType, upsert: false });
      if (upload.error && !upload.error.message.toLowerCase().includes("already exists")) {
        throw new Error(`upload ${scope.bucket}/${fileName} failed: ${upload.error.message}`);
      }
    }

    const query = await supabase.from(scope.table).select("*");
    if (query.error) {
      throw new Error(`select ${scope.table} failed: ${query.error.message}`);
    }

    for (const row of query.data ?? []) {
      const id = row.id;
      const update = {};

      const currentSingle = typeof row[scope.singleField] === "string" ? row[scope.singleField] : "";
      if (currentSingle.startsWith(scope.prefix)) {
        const fileName = currentSingle.slice(scope.prefix.length);
        if (fileSet.has(fileName)) {
          update[scope.singleField] = getPublicUrl(url, scope.bucket, fileName);
        }
      }

      if (scope.arrayField) {
        const rawArray = Array.isArray(row[scope.arrayField]) ? row[scope.arrayField] : [];
        const migratedArray = rawArray.map((item) => {
          if (typeof item !== "string" || !item.startsWith(scope.prefix)) {
            return item;
          }
          const fileName = item.slice(scope.prefix.length);
          if (!fileSet.has(fileName)) {
            return item;
          }
          return getPublicUrl(url, scope.bucket, fileName);
        });
        update[scope.arrayField] = migratedArray;
      }

      if (Object.keys(update).length > 0) {
        const apply = await supabase.from(scope.table).update(update).eq("id", id);
        if (apply.error) {
          throw new Error(`update ${scope.table}.${id} failed: ${apply.error.message}`);
        }
      }
    }
  }

  console.log("Local upload migration to Supabase Storage completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
