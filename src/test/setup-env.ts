// Route tests exercise an already-approved launch configuration unless a test
// explicitly overrides the legal gate.
process.env.KQ_PUBLIC_RULES_APPROVED = "true";
process.env.KQ_SEASON_CALENDAR_APPROVED = "true";
process.env.KQ_SEASON_PRIZES_APPROVED = "true";
process.env.KQ_SEASON_TERRITORY_APPROVED = "true";
process.env.KQ_COLLECTION_ODDS_APPROVED = "true";
process.env.KQ_LAUNCH_DOSSIER_JSON = JSON.stringify({
  seasonCode: "KQ-2026-S1",
  startsAt: "2026-10-01T10:00:00+02:00",
  endsAt: "2026-11-01T18:00:00+01:00",
  timezone: "Europe/Paris",
  territory: "France métropolitaine",
  minimumAge: 18,
  eligibility: "Résidence principale en France métropolitaine.",
  prizes: [
    { tierCode: "champion", label: "Champion", quantity: 1, stock: 1, unitValueCents: 10_000, fulfillment: "Envoi suivi" },
    { tierCode: "podium", label: "Podium", quantity: 3, stock: 3, unitValueCents: 5_000, fulfillment: "Envoi suivi" },
    { tierCode: "finalist", label: "Finaliste", quantity: 10, stock: 10, unitValueCents: 1_000, fulfillment: "Envoi suivi" },
    { tierCode: "participant", label: "Participant", quantity: 100, stock: 100, unitValueCents: 0, fulfillment: "Attribution numérique" },
  ],
  oddsVersion: "botte-70-24-6__heritage-equal-v1",
  publicRulesUrl: "https://leschanvriersbretons.com/reglement-jeu-promo",
  contactEmail: "jeu@leschanvriersbretons.com",
});
