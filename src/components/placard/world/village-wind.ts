/** Shared gust envelope. Each cloth or plant keeps its own swing and timing. */
export function villageBreezeStrength(time: number) {
  return 0.94 + 0.06 * Math.sin(time * 0.79 + Math.sin(time * 0.31));
}
