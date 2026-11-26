import { assertSha, git, validateCandidate } from "./policy.mjs";

try {
  const [base, published, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error("Usage : node scripts/seo-release/rollback.mjs <SHA-base> <SHA-publié>");
  assertSha(base);
  assertSha(published);
  if (git("rev-parse", "refs/remotes/origin/master") !== published) {
    throw new Error("Master a évolué ou le clone est désynchronisé. Une décision de rollback est requise.");
  }

  const [, firstParent, source, ...otherParents] = git("rev-list", "--parents", "-n", "1", published).split(" ");
  if (firstParent !== base || otherParents.length) throw new Error("Parent de publication inattendu.");
  const candidate = source ?? published;
  validateCandidate(base, candidate);
  if (git("rev-parse", `${published}^{tree}`) !== git("rev-parse", `${candidate}^{tree}`)) {
    throw new Error("Le rollback ciblé exige l’arbre du candidat validé.");
  }

  const tree = git("rev-parse", `${base}^{tree}`);
  console.log(git("commit-tree", tree, "-p", published, "-m", "Rétablir le repère précédent sur le rapport d’analyse"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
