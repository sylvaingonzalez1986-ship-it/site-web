"use client";

import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdminMissionReviews } from "./AdminMissionReviews";
import { formatMissionReward } from "@/lib/community-missions";
import type {
  AdminMissionsDashboard,
  AdminMissionSubmissionView,
  SocialMission,
  SocialMissionEditorInput,
  MissionReviewInput,
} from "@/types/missions";

type MissionFormState = {
  slug: string;
  title: string;
  description: string;
  icon: SocialMissionEditorInput["icon"];
  rewardType: SocialMissionEditorInput["rewardType"];
  rewardAmount: string;
  rewardCardId: string;
  maxCompletionsPerUser: string;
  requiresProof: boolean;
  proofInstructions: string;
  isActive: boolean;
};

type ReferralSettingsFormState = {
  pointsAmount: string;
  packsAmount: string;
};

const EMPTY_MISSION_FORM: MissionFormState = {
  slug: "",
  title: "",
  description: "",
  icon: "star",
  rewardType: "support_pack",
  rewardAmount: "1",
  rewardCardId: "",
  maxCompletionsPerUser: "1",
  requiresProof: true,
  proofInstructions: "",
  isActive: false,
};

const referralStatusLabels: Record<string, string> = {
  pending: "En attente",
  chosen_points: "Points choisis",
  chosen_packs: "Packs choisis",
};

const iconOptions: Array<{ value: MissionFormState["icon"]; label: string }> = [
  { value: "star", label: "Etoile" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "camera", label: "Camera" },
];

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }

  return new Date(parsed).toLocaleString("fr-FR");
}

function missionToFormState(mission: SocialMission): MissionFormState {
  return {
    slug: mission.slug,
    title: mission.title,
    description: mission.description,
    icon: mission.icon,
    rewardType: mission.rewardType,
    rewardAmount: String(mission.rewardType === "game_cash" ? mission.rewardAmount / 100 : mission.rewardAmount),
    rewardCardId: mission.rewardCardId ?? "",
    maxCompletionsPerUser: String(mission.maxCompletionsPerUser),
    requiresProof: mission.requiresProof,
    proofInstructions: mission.proofInstructions ?? "",
    isActive: mission.isActive,
  };
}

function formStateToMissionInput(form: MissionFormState): SocialMissionEditorInput {
  return {
    slug: form.slug,
    title: form.title,
    description: form.description,
    icon: form.icon,
    rewardType: form.rewardType,
    rewardAmount: form.rewardType === "game_cash" ? Math.round(Number(form.rewardAmount) * 100) : Number(form.rewardAmount),
    rewardCardId: form.rewardType === "buddies" ? form.rewardCardId || null : null,
    maxCompletionsPerUser: Number(form.maxCompletionsPerUser),
    requiresProof: form.requiresProof,
    proofInstructions: form.requiresProof ? form.proofInstructions : null,
    isActive: form.isActive,
  };
}

function getReferralSettingsFormState(
  dashboard: AdminMissionsDashboard | null,
): ReferralSettingsFormState {
  return {
    pointsAmount: String(dashboard?.referralSettings.pointsAmount ?? 50),
    packsAmount: String(dashboard?.referralSettings.packsAmount ?? 5),
  };
}

function SummaryCard({
  label,
  value,
  valueClassName = "text-ink",
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <article className="card-cartoon bg-white p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-charcoal">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClassName}`}>{value}</p>
    </article>
  );
}

export function AdminMissionsPanel() {
  const [dashboard, setDashboard] = useState<AdminMissionsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [section, setSection] = useState<"review" | "catalog" | "referral">("review");
  const reviewInFlight = useRef(false);
  const reviewRequests = useRef(new Map<string, string>());
  const catalogMutation = useRef(false);
  const noteRevisions = useRef(new Map<string, number>());
  const loadGeneration = useRef(0);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [missionForm, setMissionForm] = useState<MissionFormState>(EMPTY_MISSION_FORM);
  const [missionSaving, setMissionSaving] = useState(false);
  const [catalogBusyId, setCatalogBusyId] = useState<string | null>(null);
  const [referralSettingsForm, setReferralSettingsForm] = useState<ReferralSettingsFormState>(
    getReferralSettingsFormState(null),
  );
  const [referralSettingsSaving, setReferralSettingsSaving] = useState(false);

  const loadData = async (options?: { preserveStatus?: boolean }) => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    if (!options?.preserveStatus) {
      setStatus(null);
    }

    try {
      const response = await fetch("/api/admin/missions", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        if (generation !== loadGeneration.current) return;
        setStatus(payload.error || "Erreur chargement missions.");
        return;
      }

      const payload = (await response.json()) as Partial<AdminMissionsDashboard>;
      if (generation !== loadGeneration.current) return;
      const nextDashboard =
        payload.overview && payload.missions && payload.pendingReferrals && payload.referralSettings
          ? {
              overview: payload.overview,
              missions: payload.missions,
              pendingReferrals: payload.pendingReferrals,
              referralSettings: payload.referralSettings,
              buddyOptions: payload.buddyOptions ?? [],
            }
          : null;

      setDashboard(nextDashboard);
      if (!nextDashboard) setStatus("Réponse incomplète. Rechargez les missions.");
      const previousRevisions = noteRevisions.current;
      noteRevisions.current = new Map(nextDashboard?.overview.submissions.map((submission) => [submission.id, submission.revision]) ?? []);
      setNotesById((current) => {
        const next: Record<string, string> = {};
        for (const submission of nextDashboard?.overview.submissions ?? []) {
          next[submission.id] = previousRevisions.get(submission.id) === submission.revision
            ? current[submission.id] ?? submission.adminNote ?? ""
            : submission.adminNote ?? "";
        }
        return next;
      });
      setReferralSettingsForm(getReferralSettingsFormState(nextDashboard));
    } catch {
      if (generation === loadGeneration.current) setStatus("Chargement impossible. Vérifiez votre connexion puis rechargez.");
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    return () => { loadGeneration.current += 1; };
  }, []);

  const missions = dashboard?.missions ?? [];
  const pendingReferrals = dashboard?.pendingReferrals ?? [];
  const resetMissionEditor = () => {
    setEditingMissionId(null);
    setMissionForm(EMPTY_MISSION_FORM);
  };

  const handleReview = async (
    submission: AdminMissionSubmissionView,
    action: MissionReviewInput["action"],
  ) => {
    if (reviewInFlight.current) return;
    const adminNote = notesById[submission.id]?.trim() || "";
    if (action !== "approve" && !adminNote) {
      setStatus("Ajoutez un message au joueur pour expliquer la correction ou le refus.");
      document.getElementById(`review-note-${submission.id}`)?.focus();
      return;
    }
    reviewInFlight.current = true;
    const requestSignature = JSON.stringify([submission.id, submission.revision, action, adminNote]);
    const requestKey = reviewRequests.current.get(requestSignature) ?? crypto.randomUUID();
    reviewRequests.current.set(requestSignature, requestKey);
    setProcessingId(submission.id);

    try {
      const response = await fetch("/api/admin/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          action,
          adminNote: adminNote || undefined,
          expectedRevision: submission.revision,
          requestKey,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(payload.error || "Erreur traitement.");
        return;
      }

      setStatus(
        action === "approve"
          ? `Participation validée pour ${submission.userName} : ${formatMissionReward(submission)} attribué(s).`
          : action === "request_changes"
            ? `Correction demandée à ${submission.userName}. Aucun gain attribué.`
            : `Participation refusée pour ${submission.userName}. Aucun gain attribué.`,
      );
      await loadData({ preserveStatus: true });
    } catch {
      setStatus("Erreur reseau.");
    } finally {
      reviewInFlight.current = false;
      setProcessingId(null);
    }
  };

  const handleSaveMission = async () => {
    if (catalogMutation.current) return;
    catalogMutation.current = true;
    setMissionSaving(true);

    try {
      const response = await fetch("/api/admin/missions", {
        method: editingMissionId ? "PATCH" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingMissionId
            ? {
                kind: "mission",
                missionId: editingMissionId,
                mission: formStateToMissionInput(missionForm),
              }
            : {
                mission: formStateToMissionInput(missionForm),
              },
        ),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(payload.error || "Impossible d'enregistrer la mission.");
        return;
      }

      setStatus(editingMissionId ? "Mission mise a jour." : "Mission creee.");
      resetMissionEditor();
      await loadData({ preserveStatus: true });
    } catch {
      setStatus("Erreur reseau.");
    } finally {
      catalogMutation.current = false;
      setMissionSaving(false);
    }
  };

  const handleToggleMission = async (mission: SocialMission) => {
    if (catalogMutation.current) return;
    catalogMutation.current = true;
    setCatalogBusyId(mission.id);

    try {
      const response = await fetch("/api/admin/missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "mission",
          missionId: mission.id,
          mission: {
            ...formStateToMissionInput(missionToFormState(mission)),
            isActive: !mission.isActive,
          },
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(payload.error || "Impossible de mettre a jour la mission.");
        return;
      }

      setStatus(mission.isActive ? "Mission desactivee." : "Mission activee.");
      await loadData({ preserveStatus: true });
    } catch {
      setStatus("Erreur reseau.");
    } finally {
      catalogMutation.current = false;
      setCatalogBusyId(null);
    }
  };

  const handleMoveMission = async (missionId: string, direction: -1 | 1) => {
    if (catalogMutation.current) return;
    const currentIndex = missions.findIndex((mission) => mission.id === missionId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= missions.length) {
      return;
    }

    const reordered = [...missions];
    const [movedMission] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedMission);

    catalogMutation.current = true;
    setCatalogBusyId(missionId);

    try {
      const response = await fetch("/api/admin/missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "reorder",
          missionIds: reordered.map((mission) => mission.id),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(payload.error || "Impossible de reordonner les missions.");
        return;
      }

      setStatus("Ordre des missions mis a jour.");
      await loadData({ preserveStatus: true });
    } catch {
      setStatus("Erreur reseau.");
    } finally {
      catalogMutation.current = false;
      setCatalogBusyId(null);
    }
  };

  const handleSaveReferralSettings = async () => {
    setReferralSettingsSaving(true);

    try {
      const response = await fetch("/api/admin/missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "referralSettings",
          referralSettings: {
            pointsAmount: Number(referralSettingsForm.pointsAmount),
            packsAmount: Number(referralSettingsForm.packsAmount),
          },
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(payload.error || "Impossible d'enregistrer les récompenses.");
        return;
      }

      setStatus("Récompenses de parrainage mises à jour.");
      await loadData({ preserveStatus: true });
    } catch {
      setStatus("Erreur reseau.");
    } finally {
      setReferralSettingsSaving(false);
    }
  };

  return (
    <section className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl text-ink">Missions</h2>
        <button
          type="button"
          className="btn-cartoon btn-secondary"
          disabled={loading || Boolean(processingId) || missionSaving || Boolean(catalogBusyId)}
          onClick={() => void loadData()}
        >
          <RefreshCcw size={14} /> Recharger
        </button>
      </div>

      {status && <p role="status" className="mt-3 rounded-lg border-2 border-ink bg-white p-3 text-sm text-ink">{status}</p>}

      {!dashboard ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">
          {loading ? "Chargement des missions…" : "Les missions ne sont pas disponibles. Utilisez Recharger pour réessayer."}
        </div>
      ) : (
        <div className="mt-5 grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Missions" value={dashboard.overview.totalMissions} />
            <SummaryCard
              label="Missions actives"
              value={missions.filter((mission) => mission.isActive).length}
            />
            <SummaryCard
              label="Soumissions en attente"
              value={dashboard.overview.pendingSubmissions}
              valueClassName="text-amber-700"
            />
            <SummaryCard
              label="Parrainages en attente"
              value={pendingReferrals.filter((reward) => reward.status === "pending").length}
              valueClassName="text-blue-700"
            />
          </div>

          <nav className="flex flex-wrap gap-2" aria-label="Gestion des missions">
            {([{ key: "review", label: "Preuves à vérifier" }, { key: "catalog", label: "Catalogue et récompenses" }, { key: "referral", label: "Parrainage" }] as const).map((item) => (
              <button key={item.key} type="button" aria-pressed={section === item.key} onClick={() => setSection(item.key)} className={`min-h-11 rounded-lg border-2 border-ink px-4 text-sm font-bold ${section === item.key ? "bg-[#f4c43d] text-[#003f30]" : "bg-white text-ink"}`}>{item.label}</button>
            ))}
          </nav>
          {section === "review" && <AdminMissionReviews submissions={dashboard.overview.submissions} busy={loading || Boolean(processingId)} notes={notesById} onNote={(id, note) => setNotesById((current) => ({ ...current, [id]: note }))} onReview={(submission, action) => void handleReview(submission, action)} />}
          {section === "catalog" && <fieldset disabled={loading || missionSaving || Boolean(catalogBusyId)} className="grid min-w-0 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="card-cartoon bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl text-ink">Catalogue missions</h3>
                  <p className="text-sm text-charcoal">
                    Active, desactive et reordonne le catalogue visible cote client.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetMissionEditor}
                  className="btn-cartoon btn-primary inline-flex h-10 items-center justify-center gap-2 px-4 text-xs leading-none"
                >
                  <Plus size={14} /> Nouvelle mission
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {missions.map((mission, index) => (
                  <article
                    key={mission.id}
                    className={`rounded border-2 p-4 ${
                      editingMissionId === mission.id
                        ? "border-[#0a7b61] bg-[#eef8f4]"
                        : "border-[#1a1a1a] bg-[#f7f4ee]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{mission.title}</p>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              mission.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-stone-200 text-stone-700"
                            }`}
                          >
                            {mission.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-charcoal">/{mission.slug}</p>
                        <p className="mt-2 text-sm text-charcoal">{mission.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink">
                          <span className="pill-cartoon inline-flex items-center px-3 py-1">
                            {formatMissionReward(mission)}
                          </span>
                          <span className="pill-cartoon inline-flex items-center px-3 py-1">
                            {mission.maxCompletionsPerUser} fois max
                          </span>
                          <span className="pill-cartoon inline-flex items-center px-3 py-1">
                            {mission.requiresProof ? "Preuve requise" : "Sans preuve"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMissionId(mission.id);
                            setMissionForm(missionToFormState(mission));
                          }}
                          disabled={catalogBusyId === mission.id}
                          className="btn-cartoon btn-secondary inline-flex h-9 items-center justify-center px-3 text-[11px] leading-none"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleMission(mission)}
                          disabled={catalogBusyId === mission.id}
                          className="btn-cartoon inline-flex h-9 items-center justify-center px-3 text-[11px] leading-none"
                        >
                          {catalogBusyId === mission.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : mission.isActive ? (
                            "Desactiver"
                          ) : (
                            "Activer"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMoveMission(mission.id, -1)}
                          disabled={catalogBusyId === mission.id || index === 0}
                          className="btn-cartoon btn-secondary inline-flex h-9 w-9 items-center justify-center p-0"
                          aria-label={`Monter ${mission.title}`}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMoveMission(mission.id, 1)}
                          disabled={catalogBusyId === mission.id || index === missions.length - 1}
                          className="btn-cartoon btn-secondary inline-flex h-9 w-9 items-center justify-center p-0"
                          aria-label={`Descendre ${mission.title}`}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

                {missions.length === 0 && (
                  <p className="text-sm text-charcoal">Aucune mission configuree pour le moment.</p>
                )}
              </div>
            </article>

            <article className="card-cartoon bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl text-ink">
                    {editingMissionId ? "Modifier la mission" : "Nouvelle mission"}
                  </h3>
                  <p className="text-sm text-charcoal">
                    Les gains des participations déjà déposées restent inchangés.
                  </p>
                </div>
                {editingMissionId && (
                  <button
                    type="button"
                    onClick={resetMissionEditor}
                    className="btn-cartoon btn-secondary inline-flex h-10 items-center justify-center px-4 text-xs leading-none"
                  >
                    Annuler
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-4">
                <div>
                  <label htmlFor="mission-title" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Titre
                  </label>
                  <input id="mission-title"
                    type="text"
                    value={missionForm.title}
                    onChange={(event) =>
                      setMissionForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                  />
                </div>

                <div>
                  <label htmlFor="mission-slug" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Slug
                  </label>
                  <input id="mission-slug"
                    type="text"
                    value={missionForm.slug}
                    onChange={(event) =>
                      setMissionForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                    placeholder="presente-ta-fleur"
                  />
                </div>

                <div>
                  <label htmlFor="mission-description" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Description
                  </label>
                  <textarea id="mission-description"
                    value={missionForm.description}
                    onChange={(event) =>
                      setMissionForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="mt-1 h-24 w-full resize-none rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-2 text-sm text-ink"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="mission-icon" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                      Icone
                    </label>
                    <select id="mission-icon"
                      value={missionForm.icon}
                      onChange={(event) =>
                        setMissionForm((current) => ({
                          ...current,
                          icon: event.target.value as MissionFormState["icon"],
                        }))
                      }
                      className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                    >
                      {iconOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="mission-rewardType" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                      Récompense
                    </label>
                    <select id="mission-rewardType"
                      value={missionForm.rewardType}
                      onChange={(event) =>
                        setMissionForm((current) => ({
                          ...current,
                          rewardType: event.target.value as MissionFormState["rewardType"],
                          rewardAmount: "1",
                        }))
                      }
                      className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                    >
                      <option value="support_pack">Pack La Botte · 3 cartes</option>
                      <option value="buddies">Buddy à collectionner</option>
                      <option value="game_cash">Argent du Placard (virtuel)</option>
                      <option value="packs">Pack Buddies</option>
                      <option value="points">Points fidélité</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="mission-rewardAmount" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                      {missionForm.rewardType === "game_cash" ? "Montant en € virtuels" : "Quantité"}
                    </label>
                    <input id="mission-rewardAmount"
                      type="number"
                      min={missionForm.rewardType === "game_cash" ? 0.01 : 1}
                      step={missionForm.rewardType === "game_cash" ? 0.01 : 1}
                      max={{ packs: 20, points: 1000, support_pack: 5, buddies: 1, game_cash: 1000 }[missionForm.rewardType]}
                      value={missionForm.rewardAmount}
                      onChange={(event) =>
                        setMissionForm((current) => ({
                          ...current,
                          rewardAmount: event.target.value,
                        }))
                      }
                      className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                    />
                  </div>

                  <div>
                    <label htmlFor="mission-maxCompletionsPerUser" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                      Max par client
                    </label>
                    <input id="mission-maxCompletionsPerUser"
                      type="number"
                      min={1}
                      max={20}
                      value={missionForm.maxCompletionsPerUser}
                      onChange={(event) =>
                        setMissionForm((current) => ({
                          ...current,
                          maxCompletionsPerUser: event.target.value,
                        }))
                      }
                      className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                    />
                  </div>
                </div>

                {missionForm.rewardType === "buddies" && <div>
                  <label htmlFor="mission-buddy" className="text-sm font-semibold text-ink">Buddy offert</label>
                  <select id="mission-buddy" value={missionForm.rewardCardId} onChange={(event) => setMissionForm((current) => ({ ...current, rewardCardId: event.target.value }))} className="mt-1 min-h-11 w-full rounded border-2 border-ink bg-white px-3 text-sm text-ink">
                    <option value="">Choisir un Buddy</option>
                    {dashboard.buddyOptions.map((buddy) => <option key={buddy.id} value={buddy.id}>{buddy.name} · {buddy.rarity}</option>)}
                  </select>
                  {dashboard.buddyOptions.length === 0 && <p className="mt-1 text-sm text-charcoal">Aucun Buddy éligible dans le catalogue.</p>}
                </div>}
                <label className="flex items-center gap-3 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={missionForm.requiresProof}
                    onChange={(event) =>
                      setMissionForm((current) => ({
                        ...current,
                        requiresProof: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[#0a7b61]"
                  />
                  Capture requise pour cette mission
                </label>

                <div>
                  <label htmlFor="mission-proofInstructions" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Instructions de preuve
                  </label>
                  <textarea id="mission-proofInstructions"
                    value={missionForm.proofInstructions}
                    onChange={(event) =>
                      setMissionForm((current) => ({
                        ...current,
                        proofInstructions: event.target.value,
                      }))
                    }
                    disabled={!missionForm.requiresProof}
                    className="mt-1 h-24 w-full resize-none rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <label className="flex items-center gap-3 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={missionForm.isActive}
                    onChange={(event) =>
                      setMissionForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[#0a7b61]"
                  />
                  Mission active et visible par les joueurs
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveMission()}
                    disabled={missionSaving}
                    className="btn-cartoon btn-primary inline-flex h-10 flex-1 items-center justify-center gap-2 text-xs leading-none"
                  >
                    {missionSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {editingMissionId ? "Mettre a jour" : "Creer la mission"}
                  </button>
                  <button
                    type="button"
                    onClick={resetMissionEditor}
                    disabled={missionSaving}
                    className="btn-cartoon btn-secondary inline-flex h-10 items-center justify-center px-4 text-xs leading-none"
                  >
                    Reinitialiser
                  </button>
                </div>
              </div>
            </article>
          </fieldset>}

          {section === "referral" && <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <article className="card-cartoon bg-white p-4">
              <h3 className="font-display text-2xl text-ink">Rewards de parrainage</h3>
              <p className="mt-1 text-sm text-charcoal">
                Ces montants s&apos;appliquent aux nouvelles recompenses de parrainage creees.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={referralSettingsForm.pointsAmount}
                    onChange={(event) =>
                      setReferralSettingsForm((current) => ({
                        ...current,
                        pointsAmount: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Packs
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={referralSettingsForm.packsAmount}
                    onChange={(event) =>
                      setReferralSettingsForm((current) => ({
                        ...current,
                        packsAmount: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-charcoal">
                  Derniere mise a jour: {formatDate(dashboard.referralSettings.updatedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveReferralSettings()}
                  disabled={referralSettingsSaving}
                  className="btn-cartoon btn-primary inline-flex h-10 items-center justify-center gap-2 px-4 text-xs leading-none"
                >
                  {referralSettingsSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Enregistrer
                </button>
              </div>
            </article>
            <article className="card-cartoon bg-white p-4">
              <h3 className="font-display text-2xl text-ink">Derniers parrainages</h3>
              {pendingReferrals.length === 0 ? (
                <p className="mt-3 text-sm text-charcoal">
                  Aucune recompense de parrainage pour le moment.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {pendingReferrals.slice(0, 8).map((reward) => (
                    <div
                      key={reward.id}
                      className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">Commande {reward.orderId}</p>
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-charcoal">
                          {referralStatusLabels[reward.status] ?? reward.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-charcoal">
                        {reward.pointsAmount} points ou {reward.packsAmount} packs
                      </p>
                      <p className="mt-1 text-[11px] text-charcoal">
                        Cree le {formatDate(reward.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>}


        </div>
      )}
    </section>
  );
}
