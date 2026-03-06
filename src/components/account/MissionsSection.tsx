"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  Check,
  Clock,
  Gift,
  Instagram,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { MISSION_PROOF_ACCEPT_ATTRIBUTE } from "@/lib/mission-proof-policy";
import type {
  MissionWithUserStatus,
  ReferralPendingReward,
} from "@/types/missions";

// â”€â”€ Icon resolver â”€â”€

function MissionIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className ?? "h-5 w-5";
  switch (icon) {
    case "instagram":
      return <Instagram className={cls} />;
    case "facebook":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.025 4.388 11.013 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97H15.83c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796v8.437C19.612 23.086 24 18.098 24 12.073z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    case "camera":
      return <Camera className={cls} />;
    default:
      return <Star className={cls} />;
  }
}

// â”€â”€ Submission modal â”€â”€

function SubmitMissionModal({
  mission,
  onClose,
  onSubmitted,
}: {
  mission: MissionWithUserStatus;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [proofText, setProofText] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!proofFile) {
      setProofPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(proofFile);
    setProofPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [proofFile]);

  const submit = async () => {
    if (mission.requiresProof && !proofFile) {
      setError("Ajoute une capture d'ecran avant d'envoyer.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("missionId", mission.id);
      if (proofText.trim()) {
        formData.set("proofText", proofText.trim());
      }
      if (proofFile) {
        formData.set("file", proofFile);
      }

      const response = await fetch("/api/account/missions", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Erreur lors de la soumission.");
        return;
      }

      onSubmitted();
    } catch {
      setError("Erreur rÃ©seau.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="cartoon-border w-full max-w-md bg-cream p-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl text-ink">{mission.title}</h3>
          <button type="button" onClick={onClose} className="text-charcoal hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <p className="mt-3 text-sm text-charcoal">{mission.description}</p>

        {mission.proofInstructions && (
          <div className="mt-3 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
              Instructions
            </p>
            <p className="mt-1 text-sm text-ink">{mission.proofInstructions}</p>
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
            Capture d&apos;ecran {mission.requiresProof ? "(requise)" : "(optionnelle)"}
          </label>
          <div className="mt-1 rounded border-2 border-dashed border-[#1a1a1a] bg-white p-3">
            <input
              type="file"
              accept={MISSION_PROOF_ACCEPT_ATTRIBUTE}
              disabled={submitting}
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setProofFile(nextFile);
              }}
              className="block w-full text-sm text-charcoal file:mr-3 file:rounded file:border-0 file:bg-[#0a7b61] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
            />
            <p className="mt-2 text-[11px] text-charcoal">
              Tu peux prendre une photo ou choisir une capture depuis ta bibliotheque. Formats pris en charge: JPG, PNG ou WEBP.
            </p>
            {proofFile && (
              <p className="mt-2 text-xs font-semibold text-ink">
                {proofFile.name} ({Math.max(1, Math.round(proofFile.size / 1024))} KB)
              </p>
            )}
            {proofPreviewUrl && (
              <div className="mt-3 overflow-hidden rounded border border-[#1a1a1a] bg-[#f7f4ee]">
                <img
                  src={proofPreviewUrl}
                  alt="Apercu de la preuve"
                  className="h-48 w-full object-contain bg-[#f7f4ee]"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
            Message (optionnel)
          </label>
          <textarea
            className="mt-1 h-20 w-full resize-none border-2 border-[#1a1a1a] bg-white px-3 py-2 text-sm"
            placeholder="Un lien ou commentaire..."
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
            disabled={submitting}
          />
        </div>

        {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-cartoon btn-secondary flex-1 inline-flex h-10 items-center justify-center text-xs leading-none"
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            className="btn-cartoon btn-primary flex-1 inline-flex h-10 items-center justify-center text-xs leading-none"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Envoyer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Referral choice modal â”€â”€

function ReferralChoiceModal({
  reward,
  onClose,
  onChosen,
}: {
  reward: ReferralPendingReward;
  onClose: () => void;
  onChosen: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (choice: "points" | "packs") => {
    setChoosing(true);
    setError(null);

    try {
      const response = await fetch("/api/account/referral-choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingRewardId: reward.id,
          choice,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Erreur lors du choix.");
        return;
      }

      onChosen();
    } catch {
      setError("Erreur rÃ©seau.");
    } finally {
      setChoosing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="cartoon-border w-full max-w-md bg-cream p-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl text-ink">RÃ©compense parrainage</h3>
          <button type="button" onClick={onClose} className="text-charcoal hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <p className="mt-3 text-sm text-charcoal">
          Ton filleul a passÃ© sa premiÃ¨re commande ! Choisis ta rÃ©compense :
        </p>

        {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}

        <div className="mt-4 grid gap-3">
          <button
            type="button"
            onClick={() => choose("points")}
            disabled={choosing}
            className="card-cartoon w-full bg-white p-4 text-left transition-colors hover:bg-[#e8f7f2]"
          >
            <p className="text-lg font-bold text-ink">{reward.pointsAmount} points bonus</p>
            <p className="text-sm text-charcoal">
              Ajoute {reward.pointsAmount} points Ã  ton solde fidÃ©litÃ©
            </p>
          </button>

          <button
            type="button"
            onClick={() => choose("packs")}
            disabled={choosing}
            className="card-cartoon w-full bg-white p-4 text-left transition-colors hover:bg-[#fff3e0]"
          >
            <p className="text-lg font-bold text-ink">{reward.packsAmount} packs de cartes</p>
            <p className="text-sm text-charcoal">
              ReÃ§ois {reward.packsAmount} packs Kanab Quest Ã  gratter
            </p>
          </button>
        </div>

        {choosing && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-charcoal">
            <Loader2 className="h-4 w-4 animate-spin" /> Attribution en cours...
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€ Main Missions Section â”€â”€

export function MissionsSection() {
  const [missions, setMissions] = useState<MissionWithUserStatus[]>([]);
  const [pendingRewards, setPendingRewards] = useState<ReferralPendingReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitMission, setSubmitMission] = useState<MissionWithUserStatus | null>(null);
  const [choiceReward, setChoiceReward] = useState<ReferralPendingReward | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/account/missions", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        missions?: MissionWithUserStatus[];
        pendingRewards?: ReferralPendingReward[];
      };
      setMissions(data.missions ?? []);
      setPendingRewards(data.pendingRewards ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onSubmitted = () => {
    setSubmitMission(null);
    void loadData();
  };

  const onChosen = () => {
    setChoiceReward(null);
    void loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-charcoal">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des missions...
      </div>
    );
  }

  const pendingChoices = pendingRewards.filter((r) => r.status === "pending");

  return (
    <>
      <h2 className="font-display text-3xl">Missions</h2>
      <p className="mt-2 text-sm text-charcoal">
        Complete des missions pour gagner des packs de cartes Kanab Quest !
      </p>

      {/* Pending referral choice alerts */}
      {pendingChoices.length > 0 && (
        <div className="mt-4 grid gap-3">
          {pendingChoices.map((reward) => (
            <div
              key={reward.id}
              className="card-cartoon bg-[#fff3e0] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Gift size={16} /> RÃ©compense parrainage en attente
                  </p>
                  <p className="mt-1 text-xs text-charcoal">
                    Choisis entre {reward.pointsAmount} points ou {reward.packsAmount} packs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChoiceReward(reward)}
                  className="btn-cartoon btn-primary inline-flex h-10 items-center justify-center px-4 text-xs leading-none"
                >
                  Choisir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past referral rewards */}
      {pendingRewards.filter((r) => r.status !== "pending").length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
            RÃ©compenses parrainage passÃ©es
          </p>
          <div className="mt-2 grid gap-2">
            {pendingRewards
              .filter((r) => r.status !== "pending")
              .map((reward) => (
                <div key={reward.id} className="flex items-center gap-2 text-xs text-charcoal">
                  <Check size={14} className="text-green-600" />
                  <span>
                    {reward.status === "chosen_points"
                      ? `${reward.pointsAmount} points choisis`
                      : `${reward.packsAmount} packs choisis`}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Missions grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {missions.map((mission) => {
          const isCompleted = mission.completedCount >= mission.maxCompletionsPerUser;
          const hasPending = mission.userSubmissions.some((s) => s.status === "pending");
          const isRejected = mission.userSubmissions.some((s) => s.status === "rejected");

          return (
            <article
              key={mission.id}
              className={`card-cartoon p-4 ${
                isCompleted ? "bg-[#e8f7f2]" : hasPending ? "bg-[#fff9e5]" : "bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] ${
                    isCompleted ? "bg-[#0a7b61] text-white" : "bg-white text-ink"
                  }`}
                >
                  <MissionIcon icon={mission.icon} className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-ink">{mission.title}</p>
                  <p className="mt-1 text-xs text-charcoal">{mission.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#1a1a1a] bg-white px-2 py-0.5 text-[11px] font-bold text-ink">
                      <Gift size={12} />
                      {mission.rewardAmount}{" "}
                      {mission.rewardType === "packs" ? "pack(s)" : "points"}
                    </span>
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                        <Check size={14} /> ComplÃ©tÃ©e
                      </span>
                    )}
                    {hasPending && !isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <Clock size={14} /> En attente de validation
                      </span>
                    )}
                    {isRejected && !isCompleted && !hasPending && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                        <X size={14} /> RefusÃ©e
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {mission.canSubmit && !isCompleted && (
                <button
                  type="button"
                  onClick={() => setSubmitMission(mission)}
                  className="btn-cartoon btn-primary mt-3 inline-flex h-9 w-full items-center justify-center text-xs leading-none"
                >
                  Soumettre
                </button>
              )}

              {isRejected && mission.canSubmit && !isCompleted && (
                <p className="mt-1 text-[11px] text-charcoal">
                  Ta soumission prÃ©cÃ©dente a Ã©tÃ© refusÃ©e. Tu peux rÃ©essayer.
                </p>
              )}
            </article>
          );
        })}
      </div>

      {missions.length === 0 && (
        <p className="mt-4 text-sm text-charcoal">Aucune mission disponible pour le moment.</p>
      )}

      {/* Modals */}
      {submitMission && (
        <SubmitMissionModal
          mission={submitMission}
          onClose={() => setSubmitMission(null)}
          onSubmitted={onSubmitted}
        />
      )}
      {choiceReward && (
        <ReferralChoiceModal
          reward={choiceReward}
          onClose={() => setChoiceReward(null)}
          onChosen={onChosen}
        />
      )}
    </>
  );
}
