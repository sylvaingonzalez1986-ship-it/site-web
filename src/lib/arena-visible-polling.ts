/** One request at a time; background tabs do not poll. No catch-up burst on return. */
export function startArenaVisiblePolling(task: () => Promise<void>, intervalMs = 30_000) {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const run = async () => {
    if (stopped || running || document.hidden) return;
    clear();
    running = true;
    try { await task(); } catch { /* The next visible tick retries, without a burst. */ }
    finally {
      running = false;
      if (!stopped && !document.hidden) timer = setTimeout(() => void run(), intervalMs);
    }
  };
  const resume = () => { clear(); if (!document.hidden) void run(); };
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", resume);
  void run();
  return () => {
    stopped = true;
    clear();
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("focus", resume);
  };
}
