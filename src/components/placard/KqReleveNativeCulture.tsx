"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { KanabQuestDicePrototype } from "./KanabQuestDicePrototype";
import { KqHarvestNavigation } from "./KqHarvestNavigation";
import { KqHarvests } from "./KqHarvests";
import { createKqTutorialApi, KqTutorialApiProvider } from "./KqTutorialApiContext";
import { createReleveCultureTransport } from "@/lib/kanab-quest-releve-culture";
import type { KqClientRunSelection } from "@/lib/kanab-quest-client-run-selection";
import { applyKqReleveProductionAction, getKqReleveHarvests, getKqReleveProductionProgress, type KqReleveProductionState } from "@/lib/kanab-quest-releve-production";

type Props = { chapter: "launch" | "culture" | "jury"; state: KqReleveProductionState; onChange: (next: KqReleveProductionState) => void;
  onOpenWarehouse?: () => void; onOpenArena?: () => void; onOpenGame?: () => void;
  onOpenMarket?: (flowerId?: string) => void; onOpenStorage?: () => void; onOpenRun?: (selection: KqClientRunSelection) => void };

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}

function createPort(initial: KqReleveProductionState, notify: Props["onChange"]) {
  let current = initial;
  let callback = notify;
  return {
    getState: () => current,
    setState: (next: KqReleveProductionState) => { current = next; callback(next); },
    sync: (next: KqReleveProductionState, onChange: Props["onChange"]) => { current = next; callback = onChange; },
  };
}

/** The actual player screen. Only its transport, preferences and tutorial milestones are local. */
export function KqReleveNativeCulture({ chapter, state, onChange, onOpenWarehouse, onOpenArena, onOpenGame, onOpenMarket, onOpenStorage, onOpenRun }: Props) {
  const [port] = useState(() => createPort(state, onChange));
  const [restart, setRestart] = useState(0);
  const [harvestsOpen, setHarvestsOpen] = useState(false);
  const [selectedFlower, setSelectedFlower] = useState<string>();
  useEffect(() => { port.sync(state, onChange); }, [port, state, onChange]);
  const { getState, setState } = port;
  const mark = (milestone: string) => {
    const current = getState();
    if (!current.milestones.includes(milestone)) setState({ ...current, milestones: [...current.milestones, milestone] });
  };
  const api = useMemo(() => createKqTutorialApi(createReleveCultureTransport({ getState, setState })), [getState, setState]);
  const isolatedStorage = useMemo(() => ({ persistent: memoryStorage(), session: memoryStorage() }), []);
  const preparation = useCallback((choice: { deckCodes: string[]; heritageCode: string | null }) => {
    const current = getState();
    if (current.game || JSON.stringify(choice.deckCodes) === JSON.stringify(current.deckCodes) && choice.heritageCode === current.heritageCode) return;
    setState({ ...current, ...choice });
  }, [getState, setState]);
  const openRun = (selection: KqClientRunSelection) => {
    const campaign = getState().game?.campaign;
    if (selection.runId && !campaign?.members.some(member => member.runId === selection.runId)) return;
    if (onOpenRun) onOpenRun(selection);
    else onOpenGame?.();
  };
  const openHarvests = (section: "overview" | "storage") => {
    if (section === "storage" && onOpenStorage && getKqReleveProductionProgress("jury", getState()).complete) onOpenStorage();
    else setHarvestsOpen(true);
  };
  const observe = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-setup-choice="cards"] button[aria-label^="Ajouter une copie"]')) mark("native-deck-inspected");
    if (target.closest('[data-setup-choice="heritage"] button[aria-label^="Équiper"]')) mark("native-heritage-inspected");
    if (target.closest('[data-setup-choice="cards"] [data-culture-keep-choice]')) mark("deck-chosen");
    if (target.closest('[data-setup-choice="heritage"] [data-culture-keep-choice]')) mark("heritage-chosen");
    if (target.closest('[data-culture-campaign-recap] > summary')) mark("recap-read");
    const current = getState();
    const battleId = target.closest("[data-battle-id]")?.getAttribute("data-battle-id");
    const unread = battleId ? getKqReleveHarvests(current).find(harvest => harvest.battle?.id === battleId && harvest.battle?.status === "verdict" && !current.milestones.includes(`jury-read:${harvest.zoneId}`)) : undefined;
    if (unread && target.closest('[data-verdict-analysis] > summary')) mark(`jury-analysis:${unread.zoneId}`);
    if (unread && (target.closest('[data-verdict-result]') && (target.closest('button[aria-label="Fermer le verdict"]') || target.closest('[data-verdict-result] > footer button'))
      || target.closest('[data-archived-jury-recap] > summary'))) {
      let next = getState();
      for (let index = next.revealedRounds[unread.zoneId] ?? 0; index < unread.battle!.rounds.length; index++) next = applyKqReleveProductionAction(next, { type: "round", zoneId: unread.zoneId });
      setState(next);
    }
    if (target.closest('[data-culture-recovery-action="prepare"]') && current.checkpoint) {
      event.preventDefault(); event.stopPropagation();
      setState(applyKqReleveProductionAction(getState(), { type: "restore-stage" })); setRestart(value => value + 1);
    }
    const link = target.closest<HTMLAnchorElement>('a[href^="/arene/placard"]');
    if (link) {
      event.preventDefault();
      const view = new URL(link.href).searchParams.get("view");
      if (view === "workshop") {
        if (new URL(link.href).searchParams.get("section") === "storage") openHarvests("storage");
        else onOpenWarehouse?.();
      }
      if (view === "harvests") openHarvests(new URL(link.href).searchParams.get("section") === "storage" ? "storage" : "overview");
      if (view === "arena") onOpenArena?.();
      if (view === "market") onOpenMarket?.(new URL(link.href).searchParams.get("flower") ?? undefined);
      if (view === "game") {
        const url = new URL(link.href);
        openRun({ runId: url.searchParams.get("run") ?? undefined, zoneId: url.searchParams.get("zone") ?? undefined, campaign: true });
      }
    }
  };
  return <div data-releve-native-culture={chapter} data-releve-production={chapter} onClickCapture={observe}
    onAuxClickCapture={event => { if (event.target instanceof Element && event.target.closest('a[href^="/arene/placard"]')) observe(event); }}>
    <KqTutorialApiProvider api={api}>
      {harvestsOpen ? <KqHarvests section="overview" onSectionChange={openHarvests}
        onOpenArena={flowerId => { setSelectedFlower(flowerId); setHarvestsOpen(false); }}
        onOpenMarket={flowerId => onOpenMarket?.(flowerId)} onOpenGame={() => { setHarvestsOpen(false); onOpenGame?.(); }} /> : <>
      {chapter === "jury" ? <KqHarvestNavigation onOpenHarvests={openHarvests} /> : null}
      <KanabQuestDicePrototype key={restart} apiScope="player" viewMode={chapter === "jury" ? "arena" : "game"} showAdminOperations={false}
        initialFlowerId={selectedFlower}
        showWarehouseNavigation={false} initialCampaign isolatedStorage={isolatedStorage}
        initialPreparation={{ deckCodes: state.deckCodes, heritageCode: state.heritageCode }} onPreparationChange={preparation}
        onOpenWarehouse={onOpenWarehouse ?? (() => undefined)} onOpenArena={onOpenArena ?? (() => undefined)}
        onOpenGame={onOpenGame} onOpenMarket={onOpenMarket} onOpenRun={openRun} />
      </>}
    </KqTutorialApiProvider>
  </div>;
}
