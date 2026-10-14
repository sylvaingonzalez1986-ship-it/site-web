export type KqClientRunSelection = { zoneId?: string; runId?: string; campaign?: boolean };
type SelectableRun = {
  runId: string;
  zoneId?: string | null;
  state: { warehouse?: object; campaign?: { leaderRunId: string; members: Array<{ runId: string; zoneId: string }> } };
};

export function getKqClientRunZoneId(run: SelectableRun): string | undefined {
  if (run.zoneId) return run.zoneId;
  const warehouse = run.state.warehouse;
  return warehouse && "zoneId" in warehouse && typeof warehouse.zoneId === "string" ? warehouse.zoneId : undefined;
}

/** A requested zone never silently falls back to another culture. */
export function selectKqClientRun<T extends SelectableRun>(
  payload: { activeRun?: T | null; activeRuns?: T[] },
  selection: KqClientRunSelection,
): T | null {
  const runs = [...(payload.activeRuns ?? [])];
  if (payload.activeRun && !runs.some(run => run.runId === payload.activeRun!.runId)) runs.push(payload.activeRun);
  const inZone = (run: T) => !selection.zoneId || getKqClientRunZoneId(run) === selection.zoneId
    || !!run.state.campaign?.members.some(member => member.zoneId === selection.zoneId);
  const leader = (run: T | null) => run?.state.campaign ? runs.find(item => item.runId === run.state.campaign!.leaderRunId) ?? run : run;
  if (selection.runId) {
    const run = runs.find(item => item.runId === selection.runId)
      ?? runs.find(item => item.state.campaign?.members.some(member => member.runId === selection.runId)) ?? null;
    return run && inZone(run) ? leader(run) : null;
  }
  if (selection.zoneId) return leader(runs.find(inZone) ?? null);
  const campaign = runs.find(run => run.state.campaign);
  if (campaign) return leader(campaign);
  if (selection.campaign) return null;
  // Old whole-installation cultures remain resumable. New zone cultures are chosen explicitly.
  return runs.find(run => !getKqClientRunZoneId(run)) ?? null;
}

export const KQ_CAMPAIGN_START_SCOPE = "campaign";

type RequestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function getKqZoneStartRequestKey(storage: RequestStorage, zoneId: string, input: unknown, createKey: () => string): string {
  const key = `kq-zone-start:${zoneId}`;
  const signature = JSON.stringify(input);
  try {
    const saved = JSON.parse(storage.getItem(key) ?? "null") as { signature?: string; requestKey?: string } | null;
    if (saved?.signature === signature && typeof saved.requestKey === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved.requestKey)) return saved.requestKey;
  } catch { /* Invalid local retry metadata does not affect the server's culture. */ }
  const requestKey = createKey();
  storage.setItem(key, JSON.stringify({ signature, requestKey }));
  return requestKey;
}

export function clearKqZoneStartRequestKey(storage: RequestStorage, zoneId: string) {
  storage.removeItem(`kq-zone-start:${zoneId}`);
}
