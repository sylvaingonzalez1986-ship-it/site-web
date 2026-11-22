import { createHash } from "node:crypto";

export async function verifyPlacardTestTarget(baseUrl) {
  const database = process.env.PLACARD_TEST_DATABASE_ORIGIN;
  const version = process.env.PLACARD_TEST_VERSION;
  if (!database || !version) throw new Error("Indiquer l’origine Supabase jetable (PLACARD_TEST_DATABASE_ORIGIN) et la version de recette (PLACARD_TEST_VERSION).");
  const origin = new URL(baseUrl).origin;
  if (origin !== process.env.PLACARD_TEST_APP_ORIGIN) throw new Error("L’origine de l’application diffère de PLACARD_TEST_APP_ORIGIN.");
  if (!origin.startsWith("https://") && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) throw new Error("La recette distante exige HTTPS.");
  const response = await fetch(origin + "/api/arena/placard/test-target", { redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Application de recette non identifiée.");
  const target = await response.json();
  if (target.origin !== origin || target.version !== version || target.databaseHash !== createHash("sha256").update(database).digest("hex"))
    throw new Error("La version ou la base de l’application diffère de la cible de recette.");
  return target;
}
