import { Vector3, type Box3, type OrthographicCamera } from "three";

/** A level front view makes the face button and Home key reliable orientation landmarks. */
export const CHANVRIER_STUDIO_CAMERA_POSITION = [0, .12, 5.6] as const;

export const CHANVRIER_STUDIO_LIGHT = {
  exposure: 1.05,
  ambient: .62,
  sky: "#fff8ed",
  ground: "#e9d4b8",
  hemi: 1.28,
  key: { color: "#fff5e6", power: 2.04, position: [-3.2, 4, 6.2] },
  rim: { color: "#ffeed7", power: .68, position: [3.6, 2.7, -3.2] },
} as const;

/** Frame the whole haircut, including headwear, for a live preview or a catalogue tile. */
export function frameChanvrierStudio(
  camera: OrthographicCamera, head: Box3, view: "portrait" | "full", width: number, height: number,
) {
  const size = head.getSize(new Vector3());
  const portrait = view === "portrait";
  const vertical = portrait ? size.y * 1.38 : head.max.y + .13;
  const horizontal = portrait ? Math.max(size.x, size.z) * 1.13 : 1.08;
  const span = Math.max(vertical, horizontal * height / width);
  const centreY = portrait ? (head.min.y + head.max.y) / 2 - vertical * .085 : vertical * .48;
  camera.top = span / 2;
  camera.bottom = -camera.top;
  camera.right = camera.top * width / height;
  camera.left = -camera.right;
  camera.zoom = 1;
  camera.position.set(...CHANVRIER_STUDIO_CAMERA_POSITION);
  camera.position.y += centreY;
  camera.lookAt(0, centreY, 0);
  camera.updateProjectionMatrix();
}
