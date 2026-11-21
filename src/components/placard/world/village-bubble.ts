/** Position a readable HTML speech bubble against a projected roof, inside the stage. */
export function positionVillageBubble(panel: HTMLElement, tail: SVGPathElement | null, x: number, y: number, width: number, height: number,
  { speech = false, feetY, clearHeader = 0 }: { speech?: boolean; feetY?: number; clearHeader?: number } = {}) {
  const edge = 12;
  const topInset = speech ? Math.min(76, height / 3) : Math.max(edge, clearHeader);
  // Leave the camera controls reachable, including at 320 px.
  const rightInset = speech && height <= 540 ? 96 : width <= 760 ? 58 : 80;
  const leftSpace = x - edge - 42, rightSpace = width - rightInset - x - 42;
  // A landscape dialogue sits beside the head, leaving the actual model tappable.
  const beside = speech && width > height * 1.2 && height < 540 && Math.max(leftSpace, rightSpace) >= 180;
  const below = speech && width <= 420 && height >= 360;
  const belowTop = Math.max(topInset, Math.min(height - 132, feetY !== undefined ? feetY + 8 : y + 72));
  const toLeft = leftSpace >= rightSpace;
  const maxWidth = Math.max(180, Math.min(speech ? 380 : 326, beside ? Math.max(leftSpace, rightSpace) : width - edge - rightInset));
  panel.style.width = `${maxWidth}px`;
  const availableHeight = height - (below ? belowTop : topInset) - edge;
  panel.style.maxHeight = `${speech ? Math.max(100, availableHeight) : Math.max(0, Math.min(availableHeight, Math.max(150, y - topInset - 22)))}px`;
  const panelHeight = panel.offsetHeight;
  const left = Math.max(edge, Math.min(width - rightInset - maxWidth, beside ? toLeft ? x - 42 - maxWidth : x + 42 : x - maxWidth / 2));
  const top = below ? belowTop : Math.max(topInset, Math.min(height - panelHeight - edge, y - panelHeight * (beside ? 0.5 : 1) - (beside ? 0 : 22)));
  panel.style.transform = `translate(${left}px, ${top}px)`;
  panel.dataset.positioned = "true";
  if (!tail) return;
  const endX = Math.max(edge, Math.min(width - edge, x));
  const endY = Math.max(edge, Math.min(height - edge, y));
  if (below) {
    const baseX = Math.max(left + 24, Math.min(left + maxWidth - 24, endX));
    const tipY = feetY !== undefined ? Math.max(endY, Math.min(top - 4, feetY - 5)) : endY;
    tail.setAttribute("d", `M ${baseX - 9} ${top + 3} Q ${baseX} ${top - 10} ${endX} ${tipY} Q ${baseX + 12} ${top - 10} ${baseX + 9} ${top + 3} Z`);
    return;
  }
  if (beside) {
    const baseX = toLeft ? left + maxWidth - 3 : left + 3;
    const baseY = Math.max(top + 24, Math.min(top + panelHeight - 24, endY));
    tail.setAttribute("d", `M ${baseX} ${baseY - 9} Q ${(baseX + endX) / 2} ${baseY} ${endX} ${endY} Q ${(baseX + endX) / 2} ${baseY + 9} ${baseX} ${baseY + 9} Z`);
    return;
  }
  const baseX = Math.max(left + 24, Math.min(left + maxWidth - 24, endX));
  const bottom = top + panelHeight - 3;
  // A curved, inked point ties the paper to the roof even near a screen edge.
  tail.setAttribute("d", endY > bottom + 3
    ? `M ${baseX - 10} ${bottom} Q ${baseX} ${bottom + 16} ${endX} ${endY} Q ${baseX + 13} ${bottom + 12} ${baseX + 10} ${bottom} Z`
    : "");
}
