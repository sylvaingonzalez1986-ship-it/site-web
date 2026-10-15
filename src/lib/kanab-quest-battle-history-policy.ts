/** Completed/cancelled history only; pending verdicts remain available separately. */
export const KQ_BATTLE_HISTORY_LIMIT = 25;

export function selectKqBattleHistory<T extends { id: string; status: string; lockedAt: string; verdictAt?: string | null }>(
  battles: readonly T[],
  limit = KQ_BATTLE_HISTORY_LIMIT,
): T[] {
  const ordered = [...battles].sort((left, right) => (
    Date.parse(right.verdictAt ?? right.lockedAt) - Date.parse(left.verdictAt ?? left.lockedAt)
      || right.id.localeCompare(left.id)
  ));
  let completed = 0;
  return ordered.filter((battle) => battle.status === "locked" || completed++ < limit);
}
