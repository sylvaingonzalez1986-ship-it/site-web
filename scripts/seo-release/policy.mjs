import { execFileSync } from "node:child_process";

export const route = "/analyse-laboratoire-cbd";
export const selector = "src/app/analyse-laboratoire-cbd/seo-content.json";
export const variant = { id: "find-report", anchor: "trouver-rapport-analyse" };
export const ledgerPrefix = "seo-published/";
export const resolvedPrefix = "seo-production-resolved/";
export const pageKey = "analyse-laboratoire-cbd";
export const primaryBranch = "master";
export const candidateBranch = `seo/candidat/${variant.id}`;
export const limits = Object.freeze({ lots: 2, nouveauxContenus: 1, delaiJours: 28, budgetEuros: 0 });

const day = 24 * 60 * 60 * 1_000;
const parisDate = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
}

export function assertSha(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("SHA Git complet requis.");
}

export function selectPublicationPath(base, branch, rules) {
  if (branch.commit?.sha !== base) throw new Error("Master a changé. Une nouvelle validation est requise.");
  if (branch.protected === false && rules.length === 0) return "advance";
  if (rules.some((rule) => rule.type === "pull_request") && rules.some((rule) => rule.type === "required_status_checks"
    && rule.parameters?.strict_required_status_checks_policy === true
    && rule.parameters.required_status_checks?.length > 0)) return "merge";
  throw new Error("Protection de master détectée. La fusion automatique exige une PR et des contrôles stricts à jour avec master.");
}

function readSelection(sha) {
  const entry = git("ls-tree", sha, "--", selector);
  if (!/^100644 blob [a-f0-9]{40}\t/.test(entry)) {
    throw new Error("Le sélecteur doit être un fichier JSON ordinaire.");
  }

  const source = git("show", `${sha}:${selector}`);
  if (source.length > 128) throw new Error("Sélecteur SEO trop volumineux.");
  const value = JSON.parse(source);
  const ids = value?.variants;
  if (!Array.isArray(ids) || ids.length > 1 || ids.some((id) => id !== variant.id)) {
    throw new Error("Sélection SEO hors du registre approuvé.");
  }

  // Enforce the canonical form independently of the formatting used by the editor.
  const compact = source.replace(/\s+/g, "");
  if (compact !== JSON.stringify({ variants: ids }) || /[\u0000-\u0008]/.test(source)) {
    throw new Error("Seul le tableau variants du sélecteur est autorisé.");
  }
  return ids;
}

export function isPending(base) {
  assertSha(base);
  return readSelection(base).length === 0;
}

export function proposedSelection() {
  return `${JSON.stringify({ variants: [variant.id] }, null, 2)}\n`;
}

export function validateCandidate(base, head) {
  assertSha(base);
  assertSha(head);
  if (git("rev-list", "--parents", "-n", "1", head) !== `${head} ${base}`) {
    throw new Error("Le candidat doit être un commit unique construit sur le master courant.");
  }
  const changed = git("diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", base, head);
  if (changed !== `${selector}\0`) throw new Error("Seul le sélecteur SEO peut être modifié.");

  if (!isPending(base) || readSelection(head)[0] !== variant.id) {
    throw new Error("Le lot doit ajouter la variation approuvée, une seule fois.");
  }
}

function mondayAtParis(date) {
  const parts = Object.fromEntries(parisDate.formatToParts(date).map(({ type, value }) => [type, value]));
  const localDay = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
  return +localDay - ((localDay.getUTCDay() + 6) % 7) * day;
}

export function publicationTag(now) {
  return `${ledgerPrefix}${now.toISOString().replaceAll(":", "-")}/${pageKey}/nouveau`;
}

export function readLedger() {
  return git("for-each-ref", "--format=%(refname:strip=2)", `refs/tags/${ledgerPrefix}`).split("\n").filter(Boolean);
}

export function unresolvedPublication(ledger, resolved) {
  const verified = new Set(resolved);
  return ledger.find((tag) => !verified.has(`${resolvedPrefix}${tag.slice(ledgerPrefix.length)}`));
}

export function requireResolvedPublications() {
  const resolved = git("for-each-ref", "--format=%(refname:strip=2)", `refs/tags/${resolvedPrefix}`).split("\n");
  const pending = unresolvedPublication(readLedger(), resolved);
  if (pending) throw new Error(`Publication suspendue. Vérifier ou résoudre ${pending}.`);
}

export function enforceLimits(refs, now = new Date()) {
  const events = refs.map((ref) => {
    const entry = /^seo-published\/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2}\.\d{3}Z)\/([a-z0-9-]+)\/(nouveau|retouche)$/.exec(ref);
    if (!entry) throw new Error("Entrée inattendue dans le journal des publications SEO.");
    const time = new Date(`${entry[1]}:${entry[2]}:${entry[3]}`);
    if (!Number.isFinite(+time) || time > now) throw new Error("Date invalide dans le journal des publications SEO.");
    return { time, route: entry[4], isNew: entry[5] === "nouveau" };
  });

  const week = events.filter(({ time }) => mondayAtParis(time) === mondayAtParis(now));
  if (week.length >= limits.lots) throw new Error("Plafond de deux lots par semaine ISO atteint.");
  if (week.filter(({ isNew }) => isNew).length >= limits.nouveauxContenus) {
    throw new Error("Plafond d’un contenu nouveau par semaine ISO atteint.");
  }
  if (events.some((event) => event.route === pageKey && +now - +event.time < limits.delaiJours * day)) {
    throw new Error("Le délai de 28 jours pour cette page n’est pas écoulé.");
  }
}
