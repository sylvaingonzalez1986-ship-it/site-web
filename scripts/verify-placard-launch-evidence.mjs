import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { analyzePlacardLaunchEvidence } from "./lib/placard-launch-evidence.mjs";

const workspaceRoot = resolve(process.cwd());
const evidenceRoot = resolve(
  workspaceRoot,
  String(process.env.PLACARD_LAUNCH_EVIDENCE_ROOT || "output").trim(),
);
const evidenceRootFromWorkspace = relative(workspaceRoot, evidenceRoot);
if (
  !evidenceRootFromWorkspace
  || evidenceRootFromWorkspace === ".."
  || evidenceRootFromWorkspace.startsWith(`..${sep}`)
  || isAbsolute(evidenceRootFromWorkspace)
) {
  throw new Error("PLACARD_LAUNCH_EVIDENCE_ROOT doit désigner un sous-dossier du projet.");
}

const inputDirectories = [
  "placard-artwork-reviews",
  "placard-mobile-audits",
  "placard-mobile-manual-reviews",
  "placard-load-tests",
  "placard-smoke-tests",
  "placard-retro-evidence",
];
const reports = [];
const invalidReports = [];
for (const directoryName of inputDirectories) {
  const directory = resolve(evidenceRoot, directoryName);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    const path = resolve(directory, entry.name);
    const source = relative(workspaceRoot, path).split(sep).join("/");
    try {
      reports.push({ source, report: JSON.parse(await readFile(path, "utf8")) });
    } catch {
      invalidReports.push(source);
    }
  }
}

const maxAgeDays = Number(process.env.PLACARD_LAUNCH_EVIDENCE_MAX_AGE_DAYS || 14);
const analysis = analyzePlacardLaunchEvidence({ reports, maxAgeDays });
const report = {
  ...analysis,
  scannedDirectories: inputDirectories.map((directory) => relative(
    workspaceRoot,
    resolve(evidenceRoot, directory),
  ).split(sep).join("/")),
  invalidReports,
  passed: analysis.passed && invalidReports.length === 0,
};
const reportDirectory = resolve(evidenceRoot, "placard-launch-evidence");
const reportPath = resolve(
  reportDirectory,
  `placard-launch-evidence-${report.generatedAt.replace(/[:.]/g, "-")}.json`,
);
await mkdir(reportDirectory, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
