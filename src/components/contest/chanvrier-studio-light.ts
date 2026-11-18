/** A gentle three-quarter view, with a broad fill and an angled key to show the sculpted face. */
export const CHANVRIER_STUDIO_CAMERA_POSITION = [1.75, .24, 5.6] as const;

export const CHANVRIER_STUDIO_LIGHT = {
  exposure: .98,
  ambient: .38,
  sky: "#fff5e8",
  ground: "#aa9c8d",
  hemi: 1.12,
  key: { color: "#fff6e9", power: 2.18, position: [-3.4, 4.2, 5.6] },
  rim: { color: "#dae9ef", power: .46, position: [3.5, 2.7, -3.8] },
} as const;
