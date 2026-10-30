import { parseChanvrierProfile, type ChanvrierProfile } from "./arena-chanvrier";

/** One browser-only character rehearsal. No account, wallet or global event is written. */
export function createArenaCharacterPreviewRequest(): typeof fetch {
  let profile: ChanvrierProfile | null = null;

  return async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input), "http://character-preview.local");
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const signal = init?.signal ?? request?.signal;
    signal?.throwIfAborted();

    if (url.pathname !== "/api/arena/chanvrier" || method !== "POST") {
      return Response.json({ error: "Cette action est indisponible dans l’aperçu du personnage." }, { status: 404 });
    }

    let value: unknown;
    try {
      value = init?.body !== undefined && init.body !== null
        ? await new Response(init.body).json()
        : request ? await request.clone().json() : null;
    } catch {
      return Response.json({ error: "Profil invalide." }, { status: 400 });
    }
    signal?.throwIfAborted();

    const nextProfile = parseChanvrierProfile(value);
    if (!nextProfile) {
      return Response.json({ error: "Choisis ton apparence, ta spécialité et un surnom de 3 à 24 caractères (lettres, chiffres, point, tiret ou underscore)." }, { status: 400 });
    }
    if (profile && profile.strength !== nextProfile.strength) {
      return Response.json({ error: "Ta spécialité est définitive. Tu peux modifier ton apparence et ton surnom." }, { status: 400 });
    }

    const created = profile === null;
    profile = nextProfile;
    return Response.json({ profile, created, startingBonusCents: 0, localPreview: true });
  };
}
