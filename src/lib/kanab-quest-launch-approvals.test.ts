import { describe, expect, it } from "vitest";
import {
  areKqLaunchApprovalsComplete,
  getKqLaunchApprovalChecks,
  getKqLaunchApprovals,
  getKqLaunchDossier,
  KQ_LAUNCH_ODDS_VERSION,
} from "@/lib/kanab-quest-launch-approvals";

const VALID_DOSSIER_JSON = JSON.stringify({
  seasonCode: "KQ-2026-S1",
  startsAt: "2026-10-01T10:00:00+02:00",
  endsAt: "2026-11-01T18:00:00+01:00",
  timezone: "Europe/Paris",
  territory: "France métropolitaine",
  minimumAge: 18,
  eligibility: "Résidence principale en France métropolitaine.",
  prizes: [
    { tierCode: "champion", label: "Lot Champion", quantity: 1, stock: 1, unitValueCents: 10_000, fulfillment: "Envoi suivi sous 30 jours" },
    { tierCode: "podium", label: "Lot Podium", quantity: 3, stock: 3, unitValueCents: 5_000, fulfillment: "Envoi suivi sous 30 jours" },
    { tierCode: "finalist", label: "Lot Finaliste", quantity: 10, stock: 10, unitValueCents: 1_000, fulfillment: "Envoi suivi sous 30 jours" },
    { tierCode: "participant", label: "Titre Participant", quantity: 100, stock: 100, unitValueCents: 0, fulfillment: "Attribution numérique" },
  ],
  oddsVersion: KQ_LAUNCH_ODDS_VERSION,
  publicRulesUrl: "https://leschanvriersbretons.com/reglement-jeu-promo",
  contactEmail: "jeu@leschanvriersbretons.com",
});

describe("Kanab Quest launch approvals", () => {
  it("keeps every commercial decision closed by default", () => {
    const approvals = getKqLaunchApprovals({});
    const dossier = getKqLaunchDossier({});
    expect(areKqLaunchApprovalsComplete(approvals, dossier)).toBe(false);
    expect(getKqLaunchApprovalChecks(approvals, dossier).every((check) => !check.ready)).toBe(true);
  });

  it("does not accept approval flags without their structured evidence", () => {
    const env = {
      KQ_SEASON_CALENDAR_APPROVED: " true ",
      KQ_SEASON_PRIZES_APPROVED: "TRUE",
      KQ_SEASON_TERRITORY_APPROVED: "true",
      KQ_COLLECTION_ODDS_APPROVED: "true",
      KQ_PUBLIC_RULES_APPROVED: "true",
    };
    const approvals = getKqLaunchApprovals(env);
    const dossier = getKqLaunchDossier(env);
    expect(areKqLaunchApprovalsComplete(approvals, dossier)).toBe(false);
    expect(getKqLaunchApprovalChecks(approvals, dossier).every((check) => !check.ready)).toBe(true);
  });

  it("requires a complete dossier and every independent approval before launch", () => {
    const env = {
      KQ_LAUNCH_DOSSIER_JSON: VALID_DOSSIER_JSON,
      KQ_SEASON_CALENDAR_APPROVED: " true ",
      KQ_SEASON_PRIZES_APPROVED: "TRUE",
      KQ_SEASON_TERRITORY_APPROVED: "true",
      KQ_COLLECTION_ODDS_APPROVED: "true",
      KQ_PUBLIC_RULES_APPROVED: "true",
    };
    const approvals = getKqLaunchApprovals(env);
    const dossier = getKqLaunchDossier(env);
    expect(areKqLaunchApprovalsComplete(approvals, dossier)).toBe(true);
    expect(getKqLaunchApprovalChecks(approvals, dossier)).toHaveLength(5);
    expect(getKqLaunchApprovalChecks(approvals, dossier).every((check) => check.detail.length > 0)).toBe(true);
  });
});
