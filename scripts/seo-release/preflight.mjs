import { assertSha, git, variant } from "./policy.mjs";

const prefix = `refs/tags/seo-preflight/${variant.id}/`;

function generationPrefix(generation) {
  if (!/^[1-9]\d{0,8}$/.test(generation)) throw new Error("La génération de reprise doit être un entier positif.");
  return `${prefix}${generation}/`;
}

export function readAttempts(generation) {
  return git("for-each-ref", "--format=%(refname)", generationPrefix(generation)).split("\n").filter(Boolean);
}

export async function recordAttempt(base, generation, refs, request) {
  assertSha(base);
  const namespace = generationPrefix(generation);
  const ref = [1, 2].map((slot) => `${namespace}${slot}`).find((slot) => !refs.includes(slot));
  if (!ref) throw new Error("Deux tentatives avant publication sont épuisées. Reprise explicite du propriétaire requise.");

  // The attempt must be recorded before making any proposal or starting remote checks.
  const receipt = await request("git/refs", { method: "POST", body: { ref, sha: base } });
  if (receipt.ref !== ref || receipt.object?.sha !== base) throw new Error("Tentative avant publication non enregistrée.");
  return ref;
}
