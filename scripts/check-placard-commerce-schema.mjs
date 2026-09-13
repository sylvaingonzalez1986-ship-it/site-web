// Read-only checks using the configured project's existing service credentials.
import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error("Supabase service configuration is missing");
const project = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
if (new URL(base).hostname !== project + ".supabase.co") throw new Error("Linked project differs from the application configuration");
const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
const response=await fetch(base+'/rest/v1/',{headers:{...headers,Accept:'application/openapi+json'},signal:AbortSignal.timeout(15000)});
const schema=await response.json();
const required=['/rpc/rpc_kq_commerce_state','/rpc/rpc_kq_commerce_command','/kq_commerce_stock','/kq_commerce_campaigns','/kq_commerce_quotes'];
const missing=required.filter(path=>!schema.paths?.[path]);
console.log(JSON.stringify({projectMatches:true,status:response.status,missing}));
if(!response.ok||missing.length)process.exitCode=1;
