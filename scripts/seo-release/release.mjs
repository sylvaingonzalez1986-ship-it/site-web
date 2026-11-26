import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { checkVariant, findDeployment, github, productionOrigin, repository } from "./deployment.mjs";
import { readAttempts, recordAttempt } from "./preflight.mjs";
import { createProposal, isNativeProposal, proposals } from "./proposal.mjs";
import {
  assertSha, candidateBranch, enforceLimits, git, isPending, ledgerPrefix, limits, primaryBranch,
  publicationTag, readLedger, requireResolvedPublications, resolvedPrefix, route, selectPublicationPath, validateCandidate,
} from "./policy.mjs";

const { GITHUB_TOKEN, GITHUB_OUTPUT, GITHUB_STEP_SUMMARY } = process.env;
const request = (path, options) => github(path, GITHUB_TOKEN, options);

function output(key, value) {
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
}

function summary(message) {
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${message}\n\n`);
  console.log(message);
}

function checkContext() {
  const env = process.env;
  if (env.GITHUB_REPOSITORY !== repository || env.GITHUB_REF !== `refs/heads/${primaryBranch}`
    || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)
    || (env.GITHUB_EVENT_NAME === "schedule" && env.SEO_RELEASE_ENABLED !== "true")) {
    throw new Error("Activation à confirmer par le propriétaire.");
  }
}

function checkCost() {
  if (process.env.SEO_RELEASE_COST_CEILING_EUR !== String(limits.budgetEuros)) {
    throw new Error("Plafond de 0 € à confirmer par le propriétaire.");
  }
}

function requireSchedule() {
  if (process.env.GITHUB_EVENT_NAME !== "schedule" || process.env.SEO_RELEASE_ENABLED !== "true") {
    throw new Error("Écritures désactivées hors de la planification activée.");
  }
}

function confirmProposal(pr) {
  const pilot = process.env.GITHUB_EVENT_NAME === "workflow_dispatch"
    && /^[1-9]\d*$/.test(process.env.SEO_RELEASE_PROPOSER_ID ?? "")
    && String(pr.user?.id) === process.env.SEO_RELEASE_PROPOSER_ID;
  if (!Number.isSafeInteger(pr.number) || pr.state !== "open" || pr.draft || pr.base.repo?.full_name !== repository
    || pr.head.repo?.full_name !== repository || pr.head.ref !== candidateBranch || pr.base.ref !== primaryBranch
    || (!isNativeProposal(pr) && !pilot)) {
    throw new Error("La PR doit être ouverte, prête et issue de la branche et du compte autorisés.");
  }
  assertSha(pr.base.sha);
  assertSha(pr.head.sha);
  if (pr.base.sha !== process.env.GITHUB_SHA) {
    throw new Error("Master a changé. Une nouvelle validation est requise.");
  }
  validateCandidate(pr.base.sha, pr.head.sha);
  if (git("tag", "--points-at", pr.head.sha, "--list", `${ledgerPrefix}*`)) {
    throw new Error("Ce candidat a déjà fait l’objet d’une tentative de publication.");
  }
  enforceLimits(readLedger());
}

async function propose() {
  requireSchedule();
  requireResolvedPublications();
  const base = process.env.GITHUB_SHA;
  let selectionError;
  try {
    if (!isPending(base)) {
      summary("La variante autorisée est déjà active sur master.");
      return;
    }
  } catch (error) {
    selectionError = error;
  }
  const generation = process.env.SEO_RELEASE_PREFLIGHT_GENERATION || "1";
  const receipt = await recordAttempt(base, generation, readAttempts(generation), request);
  const execution = `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  summary(`Tentative avant publication enregistrée dans ${receipt} pour l’exécution ${execution}.`);
  if (selectionError) throw selectionError;
  checkCost();
  await publicationPath(base);
  enforceLimits(readLedger());
  const { pr, created } = await createProposal(base, request, validateCandidate);
  summary(created ? `PR #${pr.number} créée sur ${pr.head.sha}.`
    : `PR #${pr.number} déjà enregistrée (${pr.state}).`);
  output("execution", execution);
}

async function publicationPath(base) {
  const [branch, rules] = await Promise.all([
    github(`branches/${primaryBranch}`, GITHUB_TOKEN),
    github(`rules/branches/${primaryBranch}`, GITHUB_TOKEN),
  ]);
  return selectPublicationPath(base, branch, rules);
}

async function plan() {
  requireResolvedPublications();
  const pr = await proposals(request);
  if (!pr || pr.state !== "open" || !isPending(process.env.GITHUB_SHA)) {
    summary(pr?.state === "closed" ? `PR #${pr.number} fermée. Le lot reste fermé.` : "Aucune PR SEO à traiter.");
    output("ready", "false");
    return;
  }
  confirmProposal(pr);
  const path = await publicationPath(pr.base.sha);
  output("number", pr.number);
  output("head", pr.head.sha);
  output("base", pr.base.sha);
  output("ready", "true");
  summary(`PR #${pr.number}. Candidat ${pr.head.sha}, base ${pr.base.sha}. Chemin GitHub ${path}.`);
}

function crawl(origin, preview = false) {
  const args = ["scripts/seo-operator/crawl.mjs", "--base", origin, "--check", route,
    "--require-link", "/cbd-naturel", "--require-link", "/boutique"];
  if (preview) args.push("--preview");
  execFileSync(process.execPath, args, { stdio: "inherit", timeout: 90_000 });
}

async function preview(base, head) {
  const before = await findDeployment(base, "Production", primaryBranch, GITHUB_TOKEN);
  await checkVariant(productionOrigin, false);
  summary(`Déploiement de retour arrière confirmé pour ${base}. ${before.origin}`);
  const verified = await findDeployment(head, "Preview", candidateBranch, GITHUB_TOKEN, 20);
  await checkVariant(verified.origin, true, process.env.SEO_PREVIEW_BYPASS_TOKEN);
  crawl(verified.origin, true);
  summary(`Prévisualisation Vercel ${verified.id} confirmée pour ${head}.`);
}

async function merge(number, head) {
  requireSchedule();
  requireResolvedPublications();
  if (!/^[1-9]\d*$/.test(number ?? "")) throw new Error("Numéro de PR GitHub requis.");
  assertSha(head);
  const pr = await github(`pulls/${number}`, GITHUB_TOKEN);
  confirmProposal(pr);
  if (pr.head.sha !== head || pr.mergeable !== true) {
    throw new Error("Verdict GitHub favorable et SHA inchangé requis avant fusion.");
  }

  const before = await findDeployment(pr.base.sha, "Production", primaryBranch, GITHUB_TOKEN);
  await checkVariant(productionOrigin, false);
  const fresh = await github(`pulls/${number}`, GITHUB_TOKEN);
  confirmProposal(fresh);
  if (fresh.head.sha !== head || fresh.base.sha !== pr.base.sha || fresh.mergeable !== true) {
    throw new Error("La PR ou sa base a évolué. Relancer les contrôles.");
  }
  const path = await publicationPath(pr.base.sha);
  const allowableStates = path === "advance" ? ["clean", "unstable"] : ["clean"];
  if (!allowableStates.includes(fresh.mergeable_state)) throw new Error("La PR est bloquée par GitHub.");
  summary(`Avant fusion, référence de retour arrière ${before.origin} (GitHub Deployment ${before.id}, Git ${pr.base.sha}).`);

  // The native merge keeps GitHub branch rules in force. Reserve a slot before the merge to fail closed on interruption.
  const now = new Date();
  enforceLimits(readLedger(), now);
  const tag = publicationTag(now);
  const reference = `refs/tags/${tag}`;
  const reservation = await github("git/refs", GITHUB_TOKEN, { method: "POST", body: { ref: reference, sha: head } });
  if (reservation.ref !== reference || reservation.object?.sha !== head) throw new Error("Réservation GitHub introuvable.");
  summary(`Journal ${reference}, commit candidat ${head}.`);

  let published;
  if (path === "advance") {
    // The candidate has the validated base as its sole parent. GitHub rejects an advance over a newer master.
    const result = await github(`git/refs/heads/${primaryBranch}`, GITHUB_TOKEN, {
      method: "PATCH", body: { sha: head, force: false },
    });
    if (result.ref !== `refs/heads/${primaryBranch}` || result.object?.sha !== head) {
      throw new Error("Avance non forcée refusée par GitHub.");
    }
    published = head;
  } else {
    const result = await github(`pulls/${number}/merge`, GITHUB_TOKEN, {
      method: "PUT", body: { sha: head, merge_method: "merge" },
    });
    if (!result.merged) throw new Error("Fusion refusée par GitHub.");
    published = result.sha;
  }
  assertSha(published);
  output("merged", published);
  output("reservation", tag);
  summary(`PR #${number}. GitHub a placé master sur ${published}.`);
}

async function production(base, head, merged, reservation) {
  requireSchedule();
  assertSha(base);
  assertSha(head);
  assertSha(merged);
  if (!reservation?.startsWith(ledgerPrefix)) throw new Error("Réservation SEO introuvable.");
  const recorded = await github(`git/ref/tags/${reservation}`, GITHUB_TOKEN);
  if (recorded.ref !== `refs/tags/${reservation}` || recorded.object?.sha !== head) {
    throw new Error("La réservation doit désigner le candidat validé.");
  }
  const commit = await github(`git/commits/${merged}`, GITHUB_TOKEN);
  const candidate = await github(`git/commits/${head}`, GITHUB_TOKEN);
  const expectedParents = merged === head ? base : `${base} ${head}`;
  if (commit.parents?.map(({ sha }) => sha).join(" ") !== expectedParents || commit.tree?.sha !== candidate.tree?.sha) {
    throw new Error("Le commit publié doit reprendre exactement l’arbre validé et les parents attendus.");
  }
  await findDeployment(merged, "Production", primaryBranch, GITHUB_TOKEN, 32);
  const current = await github(`branches/${primaryBranch}`, GITHUB_TOKEN);
  if (current.commit?.sha !== merged) throw new Error("Master a évolué avant le contrôle de production.");
  await checkVariant(productionOrigin, true);
  crawl(productionOrigin);
  const resolved = `refs/tags/${resolvedPrefix}${reservation.slice(ledgerPrefix.length)}`;
  const marker = await github("git/refs", GITHUB_TOKEN, { method: "POST", body: { ref: resolved, sha: merged } });
  if (marker.ref !== resolved || marker.object?.sha !== merged) throw new Error("Attestation de production non confirmée.");
  summary(`Production confirmée sur ${merged} et contenu contrôlé sur ${productionOrigin}${route}.`);
}

try {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "check") {
    validateCandidate(...args);
    enforceLimits(readLedger());
    console.log("Candidat conforme.");
  } else if (mode === "local-preview") {
    const [origin] = args;
    if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(origin ?? "")) throw new Error("Origine locale Next requise.");
    await checkVariant(origin, true);
    crawl(origin);
  } else if (mode === "propose") {
    checkContext();
    await propose();
  } else {
    checkContext();
    checkCost();
    if (mode === "plan") await plan();
    else if (mode === "preview") await preview(...args);
    else if (mode === "merge") await merge(...args);
    else if (mode === "production") await production(...args);
    else throw new Error("Commande SEO inconnue.");
  }
} catch (error) {
  summary(`Bloqué · ${error.message}`);
  process.exitCode = 1;
}
