import "server-only";
import { randomInt } from "node:crypto";
import { createSupabaseServiceClient } from "./admin";
import { applyKqSocialCommand, isKqSocialSnapshot, normalizeKqSocialSnapshot, parseKqSocialCommand, refreshKqSocialSnapshot, type KqSocialCommand, type KqSocialSnapshot } from "../kanab-quest-social";
import { isKqSocialSnapshot as isLegacySnapshot } from "../kanab-quest-social-v1";
import { createKqSocialCultureContext, projectKqSocialCultureContext, type KqSocialCultureContext } from "../kanab-quest-social-culture";

export class KqSocialError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const errors: Record<string, [string, number]> = {
  social_invalid: ["Ce choix est invalide. Actualise ton aventure.", 400],
  social_profile: ["Commence ton aventure dans Kanab Quest avant d’ouvrir tes réseaux.", 403],
  social_changed: ["Ton aventure a évolué. Actualise les réseaux avant de choisir.", 409],
  social_cooldown: ["Laisse vivre ta dernière publication avant de poster sur ce réseau.", 409],
  social_energy: ["Ton énergie mentale ne suffit pas pour ce choix. Prends une pause ou attends de récupérer.", 409],
  social_energy_full: ["Ton énergie mentale est déjà au maximum.", 409],
  social_recover_cooldown: ["Cette pause sera de nouveau disponible à l’heure indiquée.", 409],
  social_request_mismatch: ["Cette référence a déjà servi à un autre choix. Actualise ton aventure.", 409],
  social_wallet_limit: ["La prime dépasserait le plafond de ta trésorerie. Libère de la place avant de la réclamer.", 409],
  social_upgrade_required: ["L’aventure a été mise à jour. Recharge la page pour continuer.", 409],
};

function failure(error: { message: string }) {
  for (const [code, [message, status]] of Object.entries(errors)) {
    if (new RegExp(`\\b${code}\\b`).test(error.message)) return new KqSocialError(message, status);
  }
  return new KqSocialError("Les réseaux sont momentanément indisponibles. Réessaie dans un instant.", 503);
}

function envelope(value: unknown) {
  if (!value || typeof value !== "object") throw new KqSocialError("Données des réseaux indisponibles.", 503);
  const row = value as Record<string, unknown>;
  if ((!isKqSocialSnapshot(row.state) && !isLegacySnapshot(row.state)) || typeof row.reputation !== "number" || !Number.isFinite(row.reputation)
    || !Number.isSafeInteger(row.cashCents) || (row.cashCents as number) < 0 || typeof row.replayed !== "boolean") throw new KqSocialError("Données des réseaux indisponibles.", 503);
  const now = Date.parse(row.state.serverNow);
  const snapshot = refreshKqSocialSnapshot(normalizeKqSocialSnapshot(row.state, now), now, row.reputation);
  if (row.replayed) snapshot.replayed = true;
  return { snapshot, now, reputation: row.reputation, cashCents: row.cashCents as number };
}

/** One read-only RPC; never use commerce/storage readers with settlement effects.
 * A failed read stays unknown, rather than claiming this player has no culture. */
export async function getKqSocialCulture(userId: string, now: number): Promise<KqSocialCultureContext> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) throw new KqSocialError(errors.social_invalid[0], 400);
  try {
    const result = await createSupabaseServiceClient().rpc("rpc_kq_social_culture", { p_user_id: userId });
    if (result.error) return createKqSocialCultureContext(now);
    return projectKqSocialCultureContext(result.data, now, "own");
  } catch { return createKqSocialCultureContext(now); }
}

export async function getKqSocial(userId: string, command?: KqSocialCommand): Promise<KqSocialSnapshot> {
  const parsed = command === undefined ? null : parseKqSocialCommand(command);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    || (command !== undefined && !parsed)) throw new KqSocialError(errors.social_invalid[0], 400);
  const client = createSupabaseServiceClient();
  const read = await client.rpc("rpc_kq_social_v2_read", { p_user_id: userId, p_command: parsed });
  if (read.error) throw failure(read.error);
  const current = envelope(read.data);
  current.snapshot.culture = await getKqSocialCulture(userId, current.now);
  if (current.snapshot.replayed) return current.snapshot;
  if (!parsed) return current.snapshot;
  let next: KqSocialSnapshot;
  try { next = applyKqSocialCommand(current.snapshot, parsed, current.now, current.reputation, randomInt(0, 101)); }
  catch (error) { throw new KqSocialError(error instanceof Error ? error.message : "Ce choix n’est plus disponible.", 409); }
  const reward = next.sponsors.earnedCents - current.snapshot.sponsors.earnedCents;
  if (current.cashCents + reward > 2147483647) throw new KqSocialError(errors.social_wallet_limit[0], 409);
  // Only this server computes followers, mental energy, branch memory and fees.
  // SQL checks the revision again, settles OLD demand and pays each receipt once.
  // Culture is a fresh presentation/eligibility projection, not persisted state.
  const persisted = { ...next };
  delete persisted.culture;
  const committed = await client.rpc("rpc_kq_social_v2_commit", { p_user_id: userId, p_command: parsed,
    p_expected_revision: current.snapshot.revision, p_expected_audience: current.snapshot.audienceFollowers,
    p_next_state: persisted, p_reward_cents: reward });
  if (committed.error) throw failure(committed.error);
  return { ...envelope(committed.data).snapshot, culture: current.snapshot.culture };
}
