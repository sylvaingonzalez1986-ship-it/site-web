/** Coordinates measured on the complete v6 master, before the common body offset.
 * Keep transparent margins: individual trims would detach the hair and features. */
export const CHANVRIER_HEAD_REGISTRATION = {
  masterSize: 1254,
  frameSize: 768,
  bodyOffset: [0, -86],
  chin: [665, 936],
  earLobe: [435, 838],
  eyes: [[625, 575, 744, 718], [753, 540, 864, 673]],
  brows: [[600, 520, 720, 592], [745, 480, 850, 542]],
  mouth: [665, 755, 850, 870],
  mouthPatch: [640, 730, 885, 884],
  browPatch: [600, 475, 865, 595],
} as const;

/** Project a master landmark into the complete character's canvas. */
export function chanvrierHeadPoint(x: number, y: number): readonly [number, number] {
  const registration = CHANVRIER_HEAD_REGISTRATION;
  const scale = registration.frameSize / registration.masterSize;
  return [x * scale + registration.bodyOffset[0], y * scale + registration.bodyOffset[1]];
}
