import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const names = ["ai-seo", "marketing-loops", "schema", "seo-audit", "site-architecture"];
const vendor = path.join(root, ".agents/third-party/marketingskills");
const manifest = JSON.parse(readFileSync(path.join(vendor, "manifest.json"), "utf8"));
const expected = new Set(manifest.files.map(file => file.sourcePath));
for (const name of names) {
  const directory = path.join(root, ".agents/skills", name);
  for (const file of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (file.isDirectory()) continue;
    const rel = path.relative(path.join(root, ".agents"), path.join(file.parentPath, file.name)).split(path.sep).join("/");
    assert.ok(file.isFile() && expected.has(rel), rel);
  }
}
for (const { sourcePath, sha256, gitBlob } of manifest.files) {
  const bytes = readFileSync(sourcePath === "LICENSE" ? path.join(vendor, "LICENSE") : path.join(root, ".agents", sourcePath));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256, sourcePath);
  assert.equal(createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex"), gitBlob, sourcePath);
}
console.log(manifest.files.length + " fichiers conformes au manifeste " + manifest.revision);
if (process.argv.includes("--codex")) {
  const server = spawn("codex", ["app-server", "--listen", "stdio://"], { cwd: root, stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
  const lines = createInterface({ input: server.stdout });
  const write = value => server.stdin.write(JSON.stringify(value) + "\n");
  const timer = setTimeout(() => { console.error("Délai de découverte dépassé"); server.kill(); process.exitCode = 1; }, 45000);
  let confirmed = false;
  try {
    write({ method: "initialize", id: 1, params: { clientInfo: { name: "lcb-seo-verification", version: "1" } } });
    for await (const line of lines) {
      const response = JSON.parse(line);
      if (response.error) throw new Error(response.error.message);
      if (response.id === 1) {
        write({ method: "initialized", params: {} });
        write({ method: "skills/list", id: 2, params: { cwds: [path.resolve(root)], forceReload: true } });
      } else if (response.id === 2) {
        const all = response.result.data.flatMap(entry => entry.skills);
        for (const name of names) {
          const local = path.join(root, ".agents", "skills", name, "SKILL.md");
          const skill = all.find(entry => entry.name === name && path.relative(local, entry.path) === "");
          assert.ok(skill?.enabled && skill.scope === "repo", name + " non découvert dans le dépôt");
          console.log(name + " : " + skill.scope + ", enabled");
        }
        confirmed = true;
        break;
      }
    }
    assert.ok(confirmed, "Réponse skills/list absente");
  } finally {
    clearTimeout(timer);
    lines.close();
    server.stdin.end();
    server.kill();
  }
}
