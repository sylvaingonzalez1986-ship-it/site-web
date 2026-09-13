// Run after `npm run build`. Estimates function payloads from Next.js traces;
// Vercel can add platform files, so leave headroom below its 250 MB limit.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appRoot = path.join(root, ".next/server/app");
const limit = 240 * 1024 * 1024;
const excludedArt = /^public\/(app|placard|contest|mascots)\//;
const invoiceAssets = [
  "public/invoice-logo.png",
  "public/invoice-sylvain-thank-you-v2-blue.png",
  "public/fonts/invoice/SpaceGrotesk-Regular.ttf",
  "public/fonts/invoice/SpaceGrotesk-Bold.ttf",
  "public/fonts/invoice/BarlowCondensed-Bold.ttf",
];
const normalize = (value) => value.split(path.sep).join("/");
const sizes = new Map();
const failures = [];
const summaries = [];
const sharedTrace = path.join(root, ".next/next-server.js.nft.json");

async function traceFiles(file) {
  const trace = JSON.parse(await readFile(file, "utf8"));
  return trace.files.map((name) => path.resolve(path.dirname(file), name));
}

const sharedFiles = await traceFiles(sharedTrace);
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (entry.name.endsWith(".nft.json")) {
      const route = normalize(path.relative(appRoot, file));
      const files = new Set([
        ...sharedFiles,
        ...await traceFiles(file),
        file.replace(/\.nft\.json$/, ""),
      ]);
      const relativeFiles = new Set([...files].map((name) => normalize(path.relative(root, name))));
      let bytes = 0;
      for (const name of files) {
        if (!sizes.has(name)) sizes.set(name, (await stat(name)).size);
        bytes += sizes.get(name);
      }
      summaries.push({ route, megabytes: Number((bytes / 1024 / 1024).toFixed(1)) });
      if (bytes > limit) failures.push(`${route}: exceeds 240 MiB safety budget`);
      if ([...relativeFiles].some((name) => excludedArt.test(name))) {
        failures.push(`${route}: CDN illustrations included in server trace`);
      }
      if (/^api\/(account|admin)\/orders\/\[orderId\]\/invoice\//.test(route)) {
        for (const name of invoiceAssets) {
          if (!relativeFiles.has(name)) failures.push(`${route}: missing ${name}`);
        }
      }
    }
  }
}

await visit(appRoot);
for (const required of ["[slug]/page.js.nft.json", "api/account/orders/[orderId]/invoice/route.js.nft.json", "api/admin/orders/[orderId]/invoice/route.js.nft.json"]) {
  if (!summaries.some(({ route }) => route === required)) failures.push(`Missing build trace: ${required}`);
}
console.log(JSON.stringify({
  routesChecked: summaries.length,
  cmsPage: summaries.find(({ route }) => route === "[slug]/page.js.nft.json"),
  largest: summaries.sort((a, b) => b.megabytes - a.megabytes).slice(0, 5),
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
