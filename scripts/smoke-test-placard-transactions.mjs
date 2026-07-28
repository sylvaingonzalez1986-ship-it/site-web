const baseUrl = (process.env.PLACARD_SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const cookie = String(process.env.PLACARD_SMOKE_COOKIE || "").trim();
const action = String(process.env.PLACARD_SMOKE_ACTION || "").trim().toLowerCase();
const confirmation = process.env.PLACARD_SMOKE_CONFIRM_BURNS === "LOCAL_BURNS_ONLY";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl);

if (!isLocal) {
  throw new Error("Ce test transactionnel refuse toujours les cibles distantes.");
}
if (!confirmation) {
  throw new Error("PLACARD_SMOKE_CONFIRM_BURNS=LOCAL_BURNS_ONLY est requis.");
}
if (!cookie) {
  throw new Error("PLACARD_SMOKE_COOKIE est requis pour le compte de recette local.");
}
if (!["card", "verdict"].includes(action)) {
  throw new Error("PLACARD_SMOKE_ACTION doit valoir card ou verdict.");
}

const runId = String(process.env.PLACARD_SMOKE_RUN_ID || "").trim();
const cardCode = String(process.env.PLACARD_SMOKE_CARD_CODE || "").trim();
const battleId = String(process.env.PLACARD_SMOKE_BATTLE_ID || "").trim();

if (action === "card" && (!runId || !cardCode)) {
  throw new Error("PLACARD_SMOKE_RUN_ID et PLACARD_SMOKE_CARD_CODE sont requis pour tester un burn.");
}
if (action === "verdict" && !battleId) {
  throw new Error("PLACARD_SMOKE_BATTLE_ID est requis pour tester un verdict.");
}

const path = action === "card"
  ? `/api/arena/placard/runs/${encodeURIComponent(runId)}/cards`
  : `/api/arena/placard/battles/${encodeURIComponent(battleId)}/verdict`;
const body = action === "card" ? JSON.stringify({ cardCode }) : undefined;
const startedAt = performance.now();
const response = await fetch(`${baseUrl}${path}`, {
  method: "POST",
  redirect: "manual",
  signal: AbortSignal.timeout(15_000),
  headers: {
    accept: "application/json",
    cookie,
    ...(body ? { "content-type": "application/json" } : {}),
    "user-agent": "placard-local-transaction-smoke/1.0",
  },
  body,
});
const payload = await response.json().catch(() => ({ error: "Réponse non JSON." }));
const summary = {
  mode: "local-transaction",
  action,
  path,
  status: response.status,
  durationMs: Math.round(performance.now() - startedAt),
  succeeded: response.ok,
  payload,
};

console.log(JSON.stringify(summary, null, 2));
if (!response.ok) process.exitCode = 1;
