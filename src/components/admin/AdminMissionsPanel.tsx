"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AdminMissionsDashboard,
  AdminMissionSubmissionView,
  SocialMission,
  SocialMissionEditorInput,
} from "@/types/missions";

type MissionFilter = "all" | "pending" | "approved" | "rejected";

type MissionFormState = {
  slug: string;
  title: string;
  description: string;
  icon: SocialMissionEditorInput["icon"];
  rewardType: SocialMissionEditorInput["rewardType"];
  rewardAmount: string;
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
  rewardType: "packs",
  rewardAmount: "1",
  maxCompletionsPerUser: "1",
  requiresProof: true,
  proofInstructions: "",
  isActive: true,
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvee",
  rejected: "Refusee",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
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
    rewardAmount: String(mission.rewardAmount),
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
    rewardAmount: Number(form.rewardAmount),
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
  const [filter, setFilter] = useState<MissionFilter>("pending");
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
    setLoading(true);
    if (!options?.preserveStatus) {
      setStatus(null);
    }

    try {
      const response = await fetch("/api/admin/missions", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setStatus(payload.error || "Erreur chargement missions.");
        setDashboard(null);
        return;
      }

      const payload = (await response.json()) as Partial<AdminMissionsDashboard>;
      const nextDashboard =
        payload.overview && payload.missions && payload.pendingReferrals && payload.referralSettings
          ? {
              overview: payload.overview,
              missions: payload.missions,
              pendingReferrals: payload.pendingReferrals,
              referralSettings: payload.referralSettings,
            }
          : null;

      setDashboard(nextDashboard);
      setNotesById((current) => {
        const next: Record<string, string> = {};
        for (const submission of nextDashboard?.overview.submissions ?? []) {
          next[submission.id] = current[submission.id] ?? submission.adminNote ?? "";
        }
        return next;
      });
      setReferralSettingsForm(getReferralSettingsFormState(nextDashboard));
    } catch {
      setStatus("Erreur reseau.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const missions = dashboard?.missions ?? [];
  const pendingReferrals = dashboard?.pendingReferrals ?? [];
  const filteredSubmissions =
    dashboard?.overview.submissions.filter((submission) =>
      filter === "all" ? true : submission.status === filter,
    ) ?? [];

  const resetMissionEditor = () => {
    setEditingMissionId(null);
    setMissionForm(EMPTY_MISSION_FORM);
  };

  const handleReview = async (
    submission: AdminMissionSubmissionView,
    action: "approve" | "reject",
  ) => {
    setProcessingId(submission.id);

    try {
      const response = await fetch("/api/admin/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          action,
          adminNote: notesById[submission.id]?.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(payload.error || "Erreur traitement.");
        return;
      }

      setStatus(
        action === "approve"
          ? `Mission approuvee pour ${submission.userName}.`
          : `Mission refusee pour ${submission.userName}.`,
      );
      await loadData({ preserveStatus: true });
    } catch {
      setStatus("Erreur reseau.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveMission = async () => {
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
      setMissionSaving(false);
    }
  };

  const handleToggleMission = async (mission: SocialMission) => {
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
      setCatalogBusyId(null);
    }
  };

  const handleMoveMission = async (missionId: string, direction: -1 | 1) => {
    const currentIndex = missions.findIndex((mission) => mission.id === missionId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= missions.length) {
      return;
    }

    const reordered = [...missions];
    const [movedMission] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedMission);

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
        setStatus(payload.error || "Impossible d'enregistrer les rewards.");
        return;
      }

      setStatus("Rewards de parrainage mis a jour.");
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
          onClick={() => void loadData()}
        >
          <RefreshCcw size={14} /> Recharger
        </button>
      </div>

      {status && <p className="mt-2 text-sm text-charcoal">{status}</p>}

      {loading || !dashboard ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">
          Chargement missions...
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

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
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
                            {mission.rewardAmount}{" "}
                            {mission.rewardType === "packs" ? "pack(s)" : "points"}
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
                    Titre, reward, preuve et visibilite client.
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
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Titre
                  </label>
                  <input
                    type="text"
                    value={missionForm.title}
                    onChange={(event) =>
                      setMissionForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={missionForm.slug}
                    onChange={(event) =>
                      setMissionForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                    placeholder="follow-instagram"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Description
                  </label>
                  <textarea
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
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                      Icone
                    </label>
                    <select
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
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                      Type de reward
                    </label>
                    <select
                      value={missionForm.rewardType}
                      onChange={(event) =>
                        setMissionForm((current) => ({
                          ...current,
                          rewardType: event.target.value as MissionFormState["rewardType"],
                        }))
                      }
                      className="mt-1 h-11 w-full rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 text-sm text-ink"
                    >
                      <option value="packs">Packs</option>
                      <option value="points">Points</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                      Quantite reward
                    </label>
                    <input
                      type="number"
                      min={1}
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
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                      Max par client
                    </label>
                    <input
                      type="number"
                      min={1}
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
                  Preuve requise pour cette mission
                </label>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                    Instructions de preuve
                  </label>
                  <textarea
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
                  Visible cote client
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
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
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
          </div>

          <article className="card-cartoon bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl text-ink">Moderation des preuves</h3>
                <p className="text-sm text-charcoal">
                  Validation et refus des soumissions clients.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["pending", "all", "approved", "rejected"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`pill-cartoon flex min-h-[36px] items-center px-3 py-1 text-xs font-bold uppercase tracking-[0.09em] ${
                      filter === value
                        ? "bg-[#1a1a1a] text-white"
                        : "border-2 border-[#1a1a1a] bg-white text-ink hover:bg-[#f0f0f0]"
                    }`}
                  >
                    {value === "all"
                      ? "Toutes"
                      : value === "pending"
                        ? "En attente"
                        : value === "approved"
                          ? "Approuvees"
                          : "Refusees"}
                  </button>
                ))}
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <p className="mt-4 text-sm text-charcoal">
                Aucune soumission dans cette categorie.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {filteredSubmissions.map((submission) => (
                  <article
                    key={submission.id}
                    className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">{submission.missionTitle}</p>
                        <p className="text-xs text-charcoal">
                          {submission.userName} ({submission.userEmail})
                        </p>
                        <p className="text-xs text-charcoal">{formatDate(submission.createdAt)}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          statusColors[submission.status] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {statusLabels[submission.status] ?? submission.status}
                      </span>
                    </div>

                    {submission.proofText && (
                      <div className="mt-2 rounded border border-[#ccc] bg-white p-2">
                        <p className="text-xs text-charcoal">{submission.proofText}</p>
                      </div>
                    )}

                    {submission.proofSignedUrl && (
                      <div className="mt-3 overflow-hidden rounded border border-[#1a1a1a] bg-white">
                        <a
                          href={submission.proofSignedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* Signed proof URLs are best rendered with native img in admin moderation. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={submission.proofSignedUrl}
                            alt={`Preuve mission ${submission.missionTitle}`}
                            className="h-56 w-full object-contain bg-[#f7f4ee]"
                          />
                        </a>
                      </div>
                    )}

                    {submission.proofUrl && (
                      <p className="mt-1 text-xs">
                        <a
                          href={submission.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 underline"
                        >
                          Voir la preuve
                        </a>
                      </p>
                    )}

                    {submission.adminNote && (
                      <p className="mt-2 text-xs text-charcoal">
                        Note admin: {submission.adminNote}
                      </p>
                    )}

                    {submission.status === "pending" && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                            Note admin
                          </label>
                          <textarea
                            value={notesById[submission.id] ?? ""}
                            onChange={(event) =>
                              setNotesById((current) => ({
                                ...current,
                                [submission.id]: event.target.value,
                              }))
                            }
                            disabled={processingId === submission.id}
                            className="mt-1 h-20 w-full resize-none rounded border border-[#1a1a1a] bg-white px-3 py-2 text-sm text-ink"
                            placeholder="Note interne sur la preuve..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleReview(submission, "approve")}
                            disabled={processingId === submission.id}
                            className="btn-cartoon inline-flex h-8 items-center justify-center gap-1 bg-green-600 px-3 text-xs leading-none text-white hover:bg-green-700"
                          >
                            {processingId === submission.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            Approuver
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReview(submission, "reject")}
                            disabled={processingId === submission.id}
                            className="btn-cartoon inline-flex h-8 items-center justify-center gap-1 bg-red-600 px-3 text-xs leading-none text-white hover:bg-red-700"
                          >
                            {processingId === submission.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X size={14} />
                            )}
                            Refuser
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
