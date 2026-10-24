const colors = [
  "fffaf1", "fff1d6", "f6f0e6", "f8f1e5", "ffffff", "fffaf0", "fff8e7",
  "00563f", "003f30", "004c39", "087b70", "172923", "f4c43d", "efc451",
  "e8efe4", "f4f5ec", "e6ebe0", "e8f7f2", "fff3e8", "f8d7da", "fff0e8", "d35400",
  "ebe8ce", "d7f0e8", "ffe8d0", "fef2f2", "000000", "eae7c5", "20312b",
  "f5ebd0", "111512", "ce5a30", "dfe6d4", "f7f1e5", "254f40", "bd4938", "e4ddca", "fffdf7", "0a4638", "0d493b",
  "e9eee3", "fffdf8", "f1f5ea", "f3eedf", "f7f4ee", "ffe8e8", "fff1db", "ffda60",
  "004b39", "086449", "93afa0", "f4ead8", "fff4cb", "f2eadc", "e7eedf", "e2f0dc",
  "fffbeb", "f4bc3c", "ddd8ce", "0b281f", "fff7e4", "fff1f1", "7a1010", "fff5da", "fee2e2",
  "d4f5dc",
] as const;

// Recolour only the decorative paper layer. Text, images and the page palette
// retain their original styles. Both materials share the same paper/ink anchors.
function paperMatrix(hex: string) {
  const paper = [250, 242, 220];
  const ink = [23, 41, 35];
  const target = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  return [...target.flatMap((channel, index) => {
    const slope = (channel - ink[index]) / (paper[index] - ink[index]);
    const row = [0, 0, 0, 0, (ink[index] / 255) * (1 - slope)];
    row[index] = slope;
    return row;
  }), 0, 0, 0, 1, 0].map(value => value.toFixed(6)).join(" ");
}

export function SiteUiMaterials() {
  return <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", overflow: "hidden", pointerEvents: "none" }}>
    <defs>
      {colors.map(color => <filter key={color} id={`site-ui-fill-${color}`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="matrix" values={paperMatrix(color)} />
      </filter>)}
      {["172923", "fffaf1", "f8f1e5", "00563f", "003f30", "f4c43d"].map(color => <filter key={color} id={`site-ui-outline-${color}`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 0 2" result="ink" />
        <feComposite in="ink" in2="SourceAlpha" operator="in" result="outline" />
        <feFlood floodColor={`#${color}`} /><feComposite in2="outline" operator="in" />
      </filter>)}
    </defs>
  </svg>;
}
