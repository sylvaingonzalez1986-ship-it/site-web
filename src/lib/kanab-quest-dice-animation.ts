/** Presentation only: never retry a roll to recover from a broken animation. */
export const KQ_DICE_ANIMATION_TIMEOUT_MS = 7_000;

export async function playKqDiceAnimation(
  animate: () => Promise<boolean>,
  timeoutMs = KQ_DICE_ANIMATION_TIMEOUT_MS,
): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(animate).catch(() => false),
      new Promise<false>((resolve) => { timeout = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
