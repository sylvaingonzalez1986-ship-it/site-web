import type { KqStorageContainerCode } from "./kanab-quest-storage";

/** Product illustrations based on manufacturer references; capacities belong to the game catalogue. */
export const KQ_STORAGE_CONTAINER_ARTWORK: Readonly<Record<KqStorageContainerCode, { src: string; alt: string }>> = {
  "GLASS-1L": { src: "/app/kanab-quest/storage/glass-1l-v1.webp", alt: "Bocal transparent de 1 litre, à couvercle orange à vis, inspiré de Le Parfait Color Vis." },
  "GLASS-2L": { src: "/app/kanab-quest/storage/glass-2l-v1.webp", alt: "Bocal en verre de 2 litres, haut et cylindrique, à couvercle orange à vis." },
  "GLASS-3L": { src: "/app/kanab-quest/storage/glass-3l-v1.webp", alt: "Grand bocal en verre de 3 litres, à épaules arrondies et couvercle orange à vis." },
  "GROVE-1OZ": { src: "/app/kanab-quest/storage/grove-1oz-v1.webp", alt: "Petit sachet noir Grove Bags TerpLoc, avec zip et fenêtre transparente bordée de vert." },
  "GROVE-1LB": { src: "/app/kanab-quest/storage/grove-1lb-v1.webp", alt: "Grand sachet Grove Bags TerpLoc d’une livre, à fond large et fenêtre transparente." },
  "BOVEDA-1L": { src: "/app/kanab-quest/storage/boveda-1l-v1.webp", alt: "Bocal à couvercle orange accompagné d’un sachet de régulation Vivi Fresh beige, bleu et rouge." },
  "CVAULT-2OZ": { src: "/app/kanab-quest/storage/cvault-2oz-v1.webp", alt: "Petit contenant CVault en inox, avec couvercle à clips et sachets Vivi Fresh." },
  "CVAULT-1LB": { src: "/app/kanab-quest/storage/cvault-1lb-v1.webp", alt: "Grand contenant CVault en inox, fermé par trois clips, accompagné de régulateurs Vivi Fresh." },
  CANNATROL: { src: "/app/kanab-quest/storage/cannatrol-v1.webp", alt: "Armoire Cannatrol Cool Cure Original noire, à porte vitrée, plateaux métalliques et boîtier de contrôle au-dessus." },
};
