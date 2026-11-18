import { CHANVRIER_HEAD_REGISTRATION as HEAD } from "./chanvrier-head-registration";

/** Registered against the existing v6 paintings, in full-frame pixels.
 * Keep clothing in its untrimmed frame: all hems, wrists and ankles already meet.
 * The head master is normalized to 768 square pixels before this translation.
 */
export const CHANVRIER_FRAME = {
  width: 768,
  height: 1280,
  head: { x: HEAD.bodyOffset[0], y: HEAD.bodyOffset[1], size: HEAD.frameSize },
  collar: { x: 384, y: 480 },
  bodyScale: { male: 1, female: .96 },
  portrait: { x: 64, y: 40, size: 592 },
  // The hoop meets the visible left earlobe; the far ear is behind the face.
  earring: { x: 238, y: 402, width: 24 },
  // Scarf belongs above the garment, behind the chin and hanging hair.
  scarf: { x: 332, y: 484, width: 134 },
} as const;
