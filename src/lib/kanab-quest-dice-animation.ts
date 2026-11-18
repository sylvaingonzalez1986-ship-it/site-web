/** Presentation only: never retry a roll to recover from a broken animation. */
export const KQ_DICE_ANIMATION_TIMEOUT_MS = 7_000;

export async function playKqDiceAnimation(
  animate: () => Promise<boolean>,
  timeoutMs = KQ_DICE_ANIMATION_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    if (signal?.aborted) return false;
    return await Promise.race([
      Promise.resolve().then(() => signal?.aborted ? false : animate()).catch(() => false),
      new Promise<false>((resolve) => {
        abort = () => resolve(false);
        signal?.addEventListener("abort", abort, { once: true });
        timeout = setTimeout(abort, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    if (abort) signal?.removeEventListener("abort", abort);
  }
}
