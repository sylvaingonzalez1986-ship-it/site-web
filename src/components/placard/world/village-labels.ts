export type VillageLabelBounds = { left: number; top: number; right: number; bottom: number };

/** Keep each sign near its doorway and leave a gap around signs and other map controls. */
export function placeVillageLabel(x: number, y: number, width: number, height: number,
  viewport: { width: number; height: number }, occupied: VillageLabelBounds[]) {
  const gap = 3;
  const lastLeft = viewport.width - width - gap;
  const lastTop = viewport.height - height - gap;
  const left = Math.max(gap, Math.min(lastLeft, x - width / 2));
  const top = Math.max(gap, Math.min(lastTop, y));
  const fits = (lx: number, ty: number) => occupied.every(rect =>
    lx + width + gap <= rect.left || lx >= rect.right + gap ||
    ty + height + gap <= rect.top || ty >= rect.bottom + gap);

  let bestLeft = left, bestTop = top;
  if (!fits(left, top)) {
    const xs = [left, ...occupied.flatMap(rect => [rect.left - width - gap, rect.right + gap])];
    const ys = [top, ...occupied.flatMap(rect => [rect.bottom + gap, rect.top - height - gap])];
    let bestCost = Infinity;
    for (const ty of ys) {
      if (ty < gap || ty > lastTop) continue;
      for (const lx of xs) {
        if (lx < gap || lx > lastLeft) continue;
        // Prefer staying below the building to covering its facade.
        const cost = (lx - left) ** 2 + (ty - top) ** 2 * (ty < top ? 4 : 2);
        if (cost >= bestCost || !fits(lx, ty)) continue;
        bestCost = cost;
        bestLeft = lx;
        bestTop = ty;
      }
    }
  }
  occupied.push({ left: bestLeft, top: bestTop, right: bestLeft + width, bottom: bestTop + height });
  return { x: bestLeft, y: bestTop };
}
