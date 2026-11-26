import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { findDeployment } from "./deployment.mjs";
import {
  candidateBranch, enforceLimits, git, isPending, proposedSelection, publicationTag, readLedger,
  requireResolvedPublications, selectPublicationPath, selector, validateCandidate,
} from "./policy.mjs";
import { createProposal } from "./proposal.mjs";

test("uniquement une addition autorisée dans le sélecteur sur le SHA courant", () => {
  const fixture = mkdtempSync(join(tmpdir(), "seo-release-test-"));
  const previousDirectory = process.cwd();
  try {
    process.chdir(fixture);
    git("init", "--quiet", "--initial-branch=master");
    git("config", "user.email", "seo-test@example.invalid");
    git("config", "user.name", "SEO test");
    git("config", "commit.gpgsign", "false");
    mkdirSync(dirname(selector), { recursive: true });
    writeFileSync(selector, '{"variants":[]}\n');
    git("add", selector);
    git("commit", "--quiet", "-m", "Base");
    const base = git("rev-parse", "HEAD");
    git("switch", "--quiet", "-c", candidateBranch);
    const prepare = fileURLToPath(new URL("./prepare.mjs", import.meta.url));
    const generated = execFileSync(process.execPath, [prepare, base, "find-report"], { encoding: "utf8" }).trim();
    assert.doesNotThrow(() => validateCandidate(base, generated));
    assert.equal(isPending(base), true);
    assert.equal(isPending(generated), false);
    assert.equal(git("rev-parse", "HEAD"), base);
    assert.equal(git("status", "--porcelain"), "");
    const tag = publicationTag(new Date("2026-11-29T22:59:00.000Z"));
    git("tag", tag, generated);
    assert.deepEqual(readLedger(), [tag]);
    assert.throws(requireResolvedPublications, /Publication suspendue/);
    git("tag", tag.replace("seo-published/", "seo-production-resolved/"), generated);
    assert.doesNotThrow(requireResolvedPublications);

    const rollback = fileURLToPath(new URL("./rollback.mjs", import.meta.url));
    git("update-ref", "refs/remotes/origin/master", generated);
    const reverted = execFileSync(process.execPath, [rollback, base, generated], { encoding: "utf8" }).trim();
    assert.equal(git("rev-parse", `${reverted}^{tree}`), git("rev-parse", `${base}^{tree}`));
    assert.equal(git("rev-parse", `${reverted}^`), generated);
    git("update-ref", "refs/remotes/origin/master", reverted);
    assert.throws(() => execFileSync(process.execPath, [rollback, base, generated], { stdio: "pipe" }), /Master a évolué/);

    function candidate(source, withOtherFile = false) {
      git("reset", "--hard", base);
      writeFileSync(selector, source);
      git("add", selector);
      if (withOtherFile) {
        writeFileSync("extra.txt", "Out of scope");
        git("add", "extra.txt");
      }
      git("commit", "--quiet", "-m", "Candidat");
      return git("rev-parse", "HEAD");
    }

    const allowed = '{"variants":["find-report"]}\n';
    const head = candidate(allowed);
    assert.doesNotThrow(() => validateCandidate(base, head));
    assert.throws(() => validateCandidate(head, head), /commit unique/);
    assert.throws(() => validateCandidate(base, candidate(allowed, true)), /Seul le sélecteur/);
    assert.throws(() => validateCandidate(base, candidate('{"variants":["autre"]}')), /registre approuvé/);
    assert.throws(() => validateCandidate(base, candidate('{"variants":[],"variants":["find-report"]}')), /tableau variants/);
    assert.throws(() => validateCandidate(base, candidate('{"variants":["find-report"],"title":"Texte"}')), /tableau variants/);
  } finally {
    process.chdir(previousDirectory);
    rmSync(fixture, { recursive: true });
  }
});

test("production d’une PR bornée, reprise d’une branche et conservation du statut fermé", async () => {
  const base = "a".repeat(40);
  const baseTree = "b".repeat(40);
  const tree = "c".repeat(40);
  const head = "d".repeat(40);
  const pr = { number: 42, state: "open", base: { sha: base }, head: { sha: head }, user: { login: "github-actions[bot]", type: "Bot" } };
  let prior;
  let existingRef;
  const writes = [];
  const request = async (path, options) => {
    if (options) writes.push([path, options]);
    if (path.startsWith("pulls?")) return prior ? [prior] : [];
    if (path.startsWith("git/matching-refs")) return existingRef ? [existingRef] : [];
    if (path === `git/commits/${base}`) return { tree: { sha: baseTree } };
    if (path === "git/trees") return { sha: tree };
    if (path === "git/commits") return { sha: head };
    if (path === "git/refs") return { ref: `refs/heads/${candidateBranch}`, object: { sha: head } };
    if (path === "pulls") return pr;
    assert.fail(`Requête non prévue ${path}`);
  };

  const created = await createProposal(base, request, () => assert.fail("Pas encore de branche"));
  assert.equal(created.created, true);
  assert.deepEqual(writes.map(([path, options]) => [path, options.method]), [
    ["git/trees", "POST"], ["git/commits", "POST"], ["git/refs", "POST"], ["pulls", "POST"],
  ]);
  assert.deepEqual(writes[0][1].body, {
    base_tree: baseTree,
    tree: [{ path: selector, mode: "100644", type: "blob", content: proposedSelection() }],
  });
  assert.deepEqual(writes[1][1].body.parents, [base]);
  assert.deepEqual(writes[2][1].body, { ref: `refs/heads/${candidateBranch}`, sha: head });

  writes.length = 0;
  existingRef = { ref: `refs/heads/${candidateBranch}`, object: { sha: head } };
  assert.equal((await createProposal(base, request, (...args) => assert.deepEqual(args, [base, head]))).created, true);
  assert.deepEqual(writes.map(([path]) => path), ["pulls"]);

  writes.length = 0;
  prior = { ...pr, state: "closed" };
  assert.deepEqual(await createProposal(base, request, () => assert.fail("PR déjà fermée")), { pr: prior, created: false });
  assert.deepEqual(writes, []);
});

test("plafonds ISO selon Paris et délai par page à la milliseconde", () => {
  const sundayParis = new Date("2026-11-29T22:59:00.000Z");
  const mondayParis = new Date("2026-11-29T23:00:00.000Z");
  const sunday = publicationTag(sundayParis);
  const other = sunday.replace("analyse-laboratoire-cbd", "autre-page");
  assert.throws(() => enforceLimits([other], sundayParis), /contenu nouveau/);
  assert.doesNotThrow(() => enforceLimits([other], mondayParis));
  assert.throws(() => enforceLimits([sunday], mondayParis), /28 jours/);
  assert.throws(() => enforceLimits([other, other.replace("59-00", "58-00")], sundayParis), /deux lots/);
  assert.throws(() => enforceLimits([sunday], new Date("2026-12-27T22:58:59.999Z")), /28 jours/);
  assert.doesNotThrow(() => enforceLimits([sunday], new Date("2026-12-27T22:59:00.000Z")));
  assert.throws(() => enforceLimits(["seo-published/incorrect"], mondayParis), /inattendue/);
  assert.throws(() => enforceLimits([sunday], new Date("2026-11-29T22:58:59.999Z")), /Date invalide/);
});

test("avance exacte sans règles et fusion native seulement sous règle stricte", () => {
  const sha = "a".repeat(40);
  const branch = { commit: { sha }, protected: false };
  const strict = {
    type: "required_status_checks",
    parameters: { strict_required_status_checks_policy: true, required_status_checks: [{ context: "test" }] },
  };
  assert.equal(selectPublicationPath(sha, branch, []), "advance");
  assert.equal(selectPublicationPath(sha, { ...branch, protected: true }, [{ type: "pull_request" }, strict]), "merge");
  assert.throws(() => selectPublicationPath(sha, branch, [strict]), /Protection/);
  assert.throws(() => selectPublicationPath(sha, { ...branch, protected: true }, []), /Protection/);
  assert.throws(() => selectPublicationPath("b".repeat(40), branch, []), /Master a changé/);
});

test("attestation Vercel du SHA exact sur le projet observé", async (context) => {
  const sha = "a".repeat(40);
  const creator = { login: "vercel[bot]", type: "Bot" };
  const origin = "https://site-782sb0bqw-sylvains-projects-d3690ef6.vercel.app";
  const deployment = { id: 42, sha, ref: sha, environment: "Preview", creator };
  const status = { state: "success", environment: "Preview", creator, environment_url: origin };
  context.mock.method(globalThis, "fetch", async (url) => {
    const result = new URL(url).pathname.endsWith("/statuses") ? [status] : [deployment];
    return Response.json(result);
  });
  assert.deepEqual(await findDeployment(sha, "Preview", candidateBranch, "mock"), { id: 42, origin });
  status.state = "inactive";
  await assert.rejects(findDeployment(sha, "Preview", candidateBranch, "mock"), /introuvable/);
  status.state = "success";
  status.environment_url = "https://site-git-candidat-sylvains-projects-d3690ef6.vercel.app";
  await assert.rejects(findDeployment(sha, "Preview", candidateBranch, "mock"), /URL de déploiement/);
  deployment.sha = "b".repeat(40);
  await assert.rejects(findDeployment(sha, "Preview", candidateBranch, "mock"), /introuvable/);
});
