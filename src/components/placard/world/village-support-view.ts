export const VILLAGE_SUPPORT_VIEW_KEY = "kq-village-support-view-v1";
const MAX_AGE_MS = 60 * 60 * 1000;

type VillageSupportView = {
  target: [number, number, number];
  radius: number;
  phi: number;
  theta: number;
  zoomRatio: number;
};

function between(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function saveVillageSupportView(view: VillageSupportView) {
  try {
    sessionStorage.setItem(VILLAGE_SUPPORT_VIEW_KEY, JSON.stringify({ ...view, savedAt: Date.now() }));
  } catch {
    // Storage may be disabled. The village can still open the support panel.
  }
}

export function consumeVillageSupportView(): VillageSupportView | null {
  try {
    const raw = sessionStorage.getItem(VILLAGE_SUPPORT_VIEW_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(VILLAGE_SUPPORT_VIEW_KEY);
    if (raw.length > 500) return null;
    const pose = JSON.parse(raw) as (VillageSupportView & { savedAt: number }) | null;
    const now = Date.now();
    if (!pose || !between(pose.savedAt, now - MAX_AGE_MS, now)) return null;
    if (!Array.isArray(pose.target) || pose.target.length !== 3 || !pose.target.every(value => between(value, -160, 160))) return null;
    if (!between(pose.radius, 1, 160) || !between(pose.phi, Math.PI / 7 - 1e-6, Math.PI / 2.6 + 1e-6)
      || !between(pose.theta, -Math.PI, Math.PI) || !between(pose.zoomRatio, .04, 40)) return null;
    return pose;
  } catch {
    return null;
  }
}
