import type { KqStorageContainerCode } from "./kanab-quest-storage";

/** Container illustrations; capacities belong to the game catalogue. */
export const KQ_STORAGE_CONTAINER_ARTWORK: Readonly<Record<KqStorageContainerCode, { src: string; alt: string }>> = {
  "CURTEC-60L": { src: "/placard/equipment-sylvain-v1/storage-3.webp", alt: "Fût de stockage illustré dans le style du Placard." },
  "GLASS-1L": { src: "/placard/equipment-sylvain-v1/container-glass-small.webp", alt: "Petit bocal de conservation en verre." },
  "GLASS-2L": { src: "/placard/equipment-sylvain-v1/container-glass-medium.webp", alt: "Bocal de conservation en verre de taille moyenne." },
  "GLASS-3L": { src: "/placard/equipment-sylvain-v1/container-glass-large.webp", alt: "Grand bocal de conservation en verre." },
  "GROVE-1OZ": { src: "/placard/equipment-sylvain-v1/container-pouch-small.webp", alt: "Petit sachet de conservation refermable." },
  "GROVE-1LB": { src: "/placard/equipment-sylvain-v1/container-pouch-large.webp", alt: "Grand sachet de conservation refermable." },
  "BOVEDA-1L": { src: "/placard/equipment-sylvain-v1/container-humidity.webp", alt: "Bocal accompagné de sachets de régulation." },
  "CVAULT-2OZ": { src: "/placard/equipment-sylvain-v1/container-tin-small.webp", alt: "Petite boîte de conservation métallique." },
  "CVAULT-1LB": { src: "/placard/equipment-sylvain-v1/container-tin-large.webp", alt: "Grande boîte de conservation métallique." },
  CANNATROL: { src: "/placard/equipment-sylvain-v1/container-cabinet.webp", alt: "Armoire de conservation illustrée dans le style du Placard." },
};
