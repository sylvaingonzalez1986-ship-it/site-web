import { KQ_BUDDIES } from "./kanab-quest-game";
import { getBuddieArtwork } from "./buddie-artwork";
import { getKqCardArtwork } from "./kanab-quest-artwork";
import { openKqSupportBooster } from "./kanab-quest-booster";
import { parseChanvrierProfile } from "./arena-chanvrier";
import { KQ_MISSION_COPY, type KqMission, type KqMissionSnapshot } from "./kanab-quest-missions";
import { CONTEST_SCORE_CRITERIA, type ContestEntrySummary, type ContestReviewSubmissionInput } from "@/types/contest";
import type { LotteryCollectedCard, LotteryCollectionPageState, ScratchResult } from "@/types/lottery";
import type { MissionWithUserStatus } from "@/types/missions";
import type { ViewerContestReview } from "./contest-public-api";
import type { ArenaLessonProgress } from "./arena-playable-learning";

export type ArenaDiscoveryLesson = "collection" | "specialties" | "missions" | "notebook";
export const DISCOVERY_TIME = "2026-10-07T12:00:00.000Z";
const DEMO_CARDS = KQ_BUDDIES.filter(card => card.rarity === "common").slice(0, 9);
export function createDiscoveryPack(): ScratchResult {
  const cards: LotteryCollectedCard[] = DEMO_CARDS.slice(0, 3).map(card => ({
    id: `tutorial-${card.code}`, collectionId: "tutorial-buddies", collectionCode: "buddies", collectionTitle: "Buddies d’essai",
    code: card.code, cardNumber: card.cardNumber, name: card.name, rarity: card.rarity,
    visualPrompt: "", description: card.ability, imageUrl: getBuddieArtwork(card.code) ?? "", isActive: true,
    createdAt: DISCOVERY_TIME, updatedAt: DISCOVERY_TIME, isOwned: true, isDuplicate: false, ownedCount: 1,
  }));
  return { ticketId: "tutorial-pack", ticketNumber: "Pack d’essai · 3 cartes préparées", scratchedAt: DISCOVERY_TIME,
    card: cards[0], cards, inventory: { totalCards: KQ_BUDDIES.length, uniqueOwned: 3, totalOwnedCopies: 3, duplicateCopies: 0, byRarity: { common: 3, silver: 0, gold: 0, epic: 0, legendary: 0 } } };
}
export function createDiscoveryAlbum(owned: boolean): LotteryCollectionPageState {
  return { rarity: "common", pageNumber: 1, label: "Communes", title: "Mon album d’essai", totalSlots: DEMO_CARDS.length,
    ownedUnique: owned ? 3 : 0, missingCount: DEMO_CARDS.length - (owned ? 3 : 0), duplicateCopies: 0,
    completionPercent: owned ? 100 * 3 / DEMO_CARDS.length : 0, isComplete: false, rewardStatus: "locked", rewardOptions: [], burnOffer: null, duplicateGroups: [],
    slots: DEMO_CARDS.map((card, index) => ({ slotIndex: index, cardDefinitionId: `tutorial-${card.code}`, code: card.code, cardNumber: card.cardNumber,
      name: card.name, rarity: "common", imageUrl: getBuddieArtwork(card.code) ?? "", description: card.ability,
      isOwned: owned && index < 3, ownedCount: owned && index < 3 ? 1 : 0, burnableCount: 0, burnableInstanceIds: [] })) };
}
export const DISCOVERY_NOTEBOOK_ENTRY: ContestEntrySummary = {
  id: "tutorial-flower", slug: "fleur-d-entrainement", title: "Fleur d’entraînement", productId: "tutorial-product", seasonId: "tutorial-season",
  producerId: "tutorial-producer", category: "indoor", track: "regular", story: "Une fleur fictive pour apprendre à utiliser ton Carnet. Les notes saisies ici ne deviennent jamais un avis publié.",
  technicalSheet: { genetics: "Exemple pédagogique", soil: "Terre", harvestLabel: "Lot fictif" }, imageUrl: "/product_flower.jpg",
  galleryUrls: [], isPublished: true, position: 0, createdAt: DISCOVERY_TIME, updatedAt: DISCOVERY_TIME,
  producer: { id: "tutorial-producer", name: "Jardin d’entraînement", region: "Arène d’essai" },
  stats: { entryId: "tutorial-flower", seasonId: "tutorial-season", category: "indoor", track: "regular", approvedReviewCount: 0, averageScore: 0, criterionAverages: {}, consumptionCounts: {} },
};

function missions(claimed: boolean, opened: boolean): KqMissionSnapshot {
  const codes = Object.keys(KQ_MISSION_COPY) as KqMission["code"][];
  const targets = [1, 3, 1, 2, 5, 10, 1, 3, 6];
  return { collectionActive: true, missions: codes.map((code, index) => ({ code, track: index < 3 ? "culture" : index < 6 ? "online" : "shops",
    step: index % 3 + 1, target: targets[index], progress: index === 0 ? 1 : 0, cardCount: index % 3 === 2 ? 10 : 3,
    claimed: index === 0 && claimed, unlocked: index % 3 === 0 || (index === 1 && claimed), claimable: index === 0 && !claimed,
    entitlementId: index === 0 && claimed ? "tutorial-mission-pack" : null, packAvailable: index === 0 && claimed && !opened })) };
}

/** A closed local transport for the real discovery screens. No network fallback. */
export function createDiscoveryTransport(lesson: ArenaDiscoveryLesson, onProgress?: (progress: ArenaLessonProgress) => void) {
  let claimed = false, opened = false, profileSaved = false, review: ViewerContestReview | null = null;
  let packPurchased = false, points = 5;
  const community: MissionWithUserStatus = {
    id: "tutorial-community", slug: "mission-d-entrainement", title: "Une mission d’entraînement", description: "Essaie le formulaire de participation avec un message fictif. Rien n’est envoyé à l’équipe.",
    icon: "camera", rewardType: "support_pack", rewardAmount: 1, maxCompletionsPerUser: 1, requiresProof: false,
    proofInstructions: "Écris une courte précision, puis envoie cette participation d’essai.", isActive: true, sortOrder: 0, rewardCardId: null,
    userSubmissions: [], completedCount: 0, canSubmit: true,
  };
  const progress = (): ArenaLessonProgress => lesson === "missions"
    ? { complete: claimed && opened, instruction: opened ? "Ton pack de mission a été ouvert. Les cartes montrées restent fictives." : claimed ? "Le pack est récupéré. Clique sur Ouvrir mon pack dans le reçu pour découvrir tes cartes ici." : "Une récolte est déjà accomplie dans cet essai. Récupère son pack dans Tous mes défis." }
    : lesson === "specialties" ? { complete: profileSaved, instruction: profileSaved ? "Ton personnage d’essai est prêt. Tu peux comparer une autre spécialité en recommençant ; ton vrai profil est inchangé." : "Crée un personnage d’essai : surnom, apparence, puis spécialité." }
      : { complete: Boolean(review), instruction: review ? "Tu as rempli la fiche d’entraînement. Aucun avis n’est publié ; le vrai Carnet décrit tes dégustations réelles." : "Feuillette la Fleur d’essai, ajuste chaque critère, puis termine ta fiche fictive." };
  const json = (value: unknown, status = 200) => Response.json(value, { status });
  const request: typeof fetch = async (input, init) => {
    const source = input instanceof Request ? input.url : String(input);
    const url = new URL(source, "https://tutorial.local");
    if (url.origin !== "https://tutorial.local") return json({ error: "Cette adresse ne fait pas partie de l’essai." }, 403);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const raw = init?.body ?? (input instanceof Request && method !== "GET" ? await input.clone().text() : null);
    let body: Record<string, unknown> = {};
    try { if (typeof raw === "string") body = JSON.parse(raw); }
    catch { return json({ error: "Action d’essai invalide." }, 400); }
    if (lesson === "specialties" && url.pathname === "/api/arena/chanvrier" && method === "POST") {
      const profile = parseChanvrierProfile(body);
      if (!profile) return json({ error: "Vérifie ton surnom et ta spécialité." }, 400);
      profileSaved = true; onProgress?.(progress()); return json({ profile });
    }
    if (lesson === "missions" && url.pathname === "/api/arena/placard/missions") {
      if (method === "GET") return json(missions(claimed, opened));
      if (method === "POST" && body.code === "first-harvest") {
        const replayed = claimed; claimed = true; onProgress?.(progress());
        return json({ entitlementId: "tutorial-mission-pack", cardCount: 3, replayed });
      }
    }
    if (lesson === "missions" && url.pathname === "/api/arena/placard/boosters") {
      if (method === "GET") return json({ collectionActive: true, costPerPack: 5, spendablePoints: points, welcomeClaimed: true,
        availableEntitlements: [...(claimed && !opened ? [{ id: "tutorial-mission-pack", source: "mission", cardCount: 3, createdAt: DISCOVERY_TIME }] : []),
          ...(packPurchased ? [{ id: "tutorial-purchased-pack", source: "purchase", cardCount: 10, createdAt: DISCOVERY_TIME }] : [])] });
      if (method === "POST" && points >= 5) { points -= 5; packPurchased = true; return json({ purchased: 1 }); }
      if (method === "PATCH" && ((body.entitlementId === "tutorial-mission-pack" && claimed && !opened) || (body.entitlementId === "tutorial-purchased-pack" && packPurchased))) {
        const count = body.entitlementId === "tutorial-mission-pack" ? 3 : 10;
        if (count === 3) opened = true; else packPurchased = false;
        onProgress?.(progress());
        return json({ cards: openKqSupportBooster(20261007).slice(0, count).map(card => ({ code: card.code, name: card.name, rarity: card.rarity, imageUrl: getKqCardArtwork(card.code) })) });
      }
    }
    if (lesson === "missions" && url.pathname === "/api/account/missions") {
      if (method === "GET") return json({ missions: [community], pendingRewards: [] });
      if (method === "POST" && raw instanceof FormData && raw.get("missionId") === community.id && community.canSubmit) {
        community.canSubmit = false;
        community.userSubmissions = [{ id: "tutorial-submission", userId: "tutorial", missionId: community.id, missionTitle: community.title,
          proofUrl: null, proofStoragePath: null, proofContentType: null, proofFileSize: null, proofUploadedAt: null,
          proofText: String(raw.get("proofText") ?? ""), status: "pending", adminNote: null, reviewedBy: null, reviewedAt: null, rewardGranted: false,
          revision: 0, rewardType: "support_pack", rewardAmount: 1, rewardCardId: null, rewardCardName: null, rewardLabel: "Pack fictif", createdAt: DISCOVERY_TIME }];
        return json({ submitted: true });
      }
    }
    if (lesson === "notebook" && url.pathname === "/api/contest/producer-rewards" && method === "GET") return json({ campaigns: [] });
    if (lesson === "notebook" && url.pathname === "/api/contest/reviews" && ["POST", "PUT"].includes(method)) {
      const data = body as unknown as ContestReviewSubmissionInput;
      if (data.entryId !== DISCOVERY_NOTEBOOK_ENTRY.id || !CONTEST_SCORE_CRITERIA.every(key => Number.isFinite(data.scores?.[key]) && data.scores[key] >= 0 && data.scores[key] <= 100)) return json({ error: "Vérifie les critères de ta fiche d’essai." }, 400);
      review = { id: "tutorial-review", entryId: data.entryId, seasonId: "tutorial-season", pseudo: "Apprenti", consumptionMethod: data.consumptionMethod,
        consumptionDetails: data.consumptionDetails, comment: data.comment ?? "", status: "pending", adminNote: "", qualityMark: "", createdAt: DISCOVERY_TIME,
        updatedAt: DISCOVERY_TIME, scores: CONTEST_SCORE_CRITERIA.map(criterion => ({ criterion, score: data.scores[criterion] })), aromaTags: data.aromaTags, terpeneGuesses: data.terpeneGuesses ?? [] };
      onProgress?.(progress()); return json({ review });
    }
    return json({ error: "Cette action n’est pas disponible dans cet essai. Reviens à la consigne pour continuer." }, 400);
  };
  return { request, progress };
}
