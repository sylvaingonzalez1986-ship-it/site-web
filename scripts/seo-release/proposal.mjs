import { repository } from "./deployment.mjs";
import { assertSha, candidateBranch, primaryBranch, proposedSelection, selector } from "./policy.mjs";

const branchRef = `refs/heads/${candidateBranch}`;
const author = "github-actions[bot]";

export function isNativeProposal(pr) {
  return pr.user?.login === author && pr.user.type === "Bot";
}

export async function proposals(request) {
  const query = new URLSearchParams({ state: "all", base: primaryBranch, head: `${repository.split("/")[0]}:${candidateBranch}` });
  const result = await request(`pulls?${query}`);
  if (result.length > 1) throw new Error("Plusieurs PR existent pour cette variante.");
  return result[0];
}

export async function createProposal(base, request, validateExisting) {
  const existing = await proposals(request);
  if (existing) return { pr: existing, created: false };

  const refs = await request(`git/matching-refs/heads/${candidateBranch}`);
  const previous = refs.find((entry) => entry.ref === branchRef);
  let head = previous?.object?.sha;
  if (previous) {
    assertSha(head);
    validateExisting(base, head);
  } else {
    const parent = await request(`git/commits/${base}`);
    assertSha(parent.tree?.sha);
    const tree = await request("git/trees", { method: "POST", body: {
      base_tree: parent.tree.sha,
      tree: [{ path: selector, mode: "100644", type: "blob", content: proposedSelection() }],
    } });
    assertSha(tree.sha);
    const commit = await request("git/commits", { method: "POST", body: {
      tree: tree.sha,
      parents: [base],
      message: "Ajouter le repère sur le rapport d’analyse",
    } });
    head = commit.sha;
    assertSha(head);
    const branch = await request("git/refs", { method: "POST", body: { ref: branchRef, sha: head } });
    if (branch.ref !== branchRef || branch.object?.sha !== head) throw new Error("Création de la branche candidate non confirmée.");
  }

  const pr = await request("pulls", { method: "POST", body: {
    title: "SEO · Ajouter le repère sur le rapport d’analyse",
    body: `Lot généré depuis le registre de contenus relus. Base \`${base}\`, candidat \`${head}\`.`,
    head: candidateBranch,
    base: primaryBranch,
  } });
  if (!isNativeProposal(pr) || pr.head?.sha !== head || pr.base?.sha !== base) throw new Error("Création de la PR SEO non confirmée.");
  return { pr, created: true };
}
