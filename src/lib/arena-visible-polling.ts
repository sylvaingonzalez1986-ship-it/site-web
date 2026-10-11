/** One request at a time; background tabs do not poll. No catch-up burst on return. */
export function startArenaVisiblePolling(task: () => Promise<void>, intervalMs: number | (() => number) = 30_000) {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const schedule = () => {
    clear();
    if (stopped || running || document.hidden) return;
    const delay = typeof intervalMs === "function" ? intervalMs() : intervalMs;
    timer = setTimeout(() => void run(), Math.max(1_000, delay));
  };
  const run = async () => {
    if (stopped || running || document.hidden) return;
    clear();
    running = true;
    try { await task(); } catch { /* The next visible tick retries, without a burst. */ }
    finally {
      running = false;
      schedule();
    }
  };
  const resume = () => { clear(); if (!document.hidden) void run(); };
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", resume);
  void run();
  const stop = () => {
    stopped = true;
    clear();
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("focus", resume);
  };
  // A mutation already returns fresh state; update its deadline without an extra GET.
  return Object.assign(stop, { refresh: run, reschedule: schedule });
}
