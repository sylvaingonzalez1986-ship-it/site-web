import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSha, enforceLimits, proposedSelection, readLedger, selector, validateCandidate, variant } from "./policy.mjs";

const [base, id, ...extra] = process.argv.slice(2);
if (extra.length || id !== variant.id) throw new Error("Usage : node scripts/seo-release/prepare.mjs <SHA-master> find-report");
assertSha(base);
enforceLimits(readLedger());

const temporary = mkdtempSync(join(tmpdir(), "seo-release-index-"));
try {
  const env = { ...process.env, GIT_INDEX_FILE: join(temporary, "index") };
  const gitWithIndex = (args, input) => execFileSync("git", args, { env, input, encoding: "utf8" }).trim();
  gitWithIndex(["read-tree", base]);
  const blob = gitWithIndex(["hash-object", "-w", "--stdin"], proposedSelection());
  gitWithIndex(["update-index", "--add", "--cacheinfo", `100644,${blob},${selector}`]);
  const tree = gitWithIndex(["write-tree"]);
  const candidate = gitWithIndex(["commit-tree", tree, "-p", base, "-m", "Ajouter le repère sur le rapport d’analyse"]);
  validateCandidate(base, candidate);
  console.log(candidate);
} finally {
  rmSync(temporary, { recursive: true });
}
