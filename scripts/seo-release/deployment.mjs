import { setTimeout as wait } from "node:timers/promises";
import { assertSha, route, variant } from "./policy.mjs";

export const productionOrigin = "https://www.leschanvriersbretons.com";
export const repository = "sylvaingonzalez1986-ship-it/site-web";

export async function github(path, token, request = {}) {
  if (!token) throw new Error("Jeton GitHub natif requis.");
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: request.method ?? "GET",
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}.`);
  return response.json();
}

function immutableVercelOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.href !== `${url.origin}/` || url.port || url.username || url.password
    || !/^site-[a-z\d]+-sylvains-projects-d3690ef6\.vercel\.app$/.test(url.hostname)) {
    throw new Error("URL de déploiement Vercel immuable et du projet vérifié requise.");
  }
  return url.origin;
}

function fromVercel({ creator }) {
  return creator?.login === "vercel[bot]" && creator.type === "Bot";
}

export async function findDeployment(sha, environment, expectedRef, token, attempts = 1) {
  assertSha(sha);
  if (!environment) throw new Error("Nom de l’environnement Vercel observé dans GitHub requis.");
  const query = new URLSearchParams({ sha, environment, per_page: "20" });
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const deployments = await github(`deployments?${query}`, token);
    const deployment = deployments.find((entry) => entry.sha === sha && fromVercel(entry)
      && entry.environment === environment && [sha, expectedRef, `refs/heads/${expectedRef}`].includes(entry.ref));
    if (deployment && Number.isSafeInteger(deployment.id)) {
      const statuses = await github(`deployments/${deployment.id}/statuses?per_page=20`, token);
      const status = statuses.find(fromVercel);
      if (["failure", "error"].includes(status?.state)) throw new Error("Déploiement Vercel en échec.");
      if (status?.state === "success" && status.environment === environment) {
        return { id: deployment.id, origin: immutableVercelOrigin(status.environment_url) };
      }
    }
    if (attempt + 1 < attempts) await wait(15_000);
  }
  throw new Error("Déploiement Vercel prêt et attribué au SHA attendu introuvable.");
}

export async function checkVariant(origin, present, bypassToken = "") {
  const response = await fetch(`${origin}${route}`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "SEO publication check",
      ...(bypassToken && { "x-vercel-protection-bypass": bypassToken }),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/html")) {
    throw new Error(`Le guide ne renvoie pas de document HTML HTTP 200 (${response.status}).`);
  }
  const html = await response.text();
  if (html.includes(`id="${variant.anchor}"`) !== present) {
    throw new Error("La variation attendue ne correspond pas au HTML initial.");
  }
}
