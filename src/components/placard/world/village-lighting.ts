/** Default daylight on the village map and its isometric preview in the fitting room. */
export const VILLAGE_LIGHT = {
  exposure: 1.08, ambient: .23,
  sky: "#e3eff0", ground: "#778b73", hemi: 1.19,
  key: { color: "#ffedd2", power: 2.68, position: [-16, 26, 17] },
  rim: { color: "#c1e1e7", power: .63, position: [15, 14, -20] },
} as const;
