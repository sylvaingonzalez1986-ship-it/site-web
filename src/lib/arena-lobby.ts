export const ARENA_LOBBY_MODES = {
  carnet: {
    number: "01", name: "Le Carnet", label: "Déguste. Note. Collectionne.",
    description: "Tes dégustations ont du pouvoir.",
    href: "/arene/carnet/regular", action: "Ouvrir mon Carnet", frequency: 330,
    image: "/contest/map/arena-desk-sylvain-v6.webp",
    imageAlt: "Sylvain note sa dégustation dans son carnet, à la lumière de son bureau.",
  },
  jouer: {
    number: "02", name: "Kanab Quest", label: "Cultive. Affronte. Recommence.",
    description: "À toi de faire pousser ta réputation.",
    href: "/arene/placard", action: "Jouer à Kanab Quest", frequency: 440,
    image: "/placard/map/culture-barn-sylvain-v1.webp",
    imageAlt: "La petite grange de culture aux portes turquoise dans le village de Sylvain.",
  },
  classement: {
    number: "03", name: "Le Classement", label: "Fais-toi un nom.",
    description: "Dégustations, duels et entreprise font ta place au village.",
    href: "/arene?vue=classement", action: "Voir les classements", frequency: 550,
    image: "/contest/mascot/arena-scene-classement-sylvain-v3.webp",
    imageAlt: "Sylvain présente son trophée sur le podium en bois de la halle du village.",
  },
} as const;

export type ArenaLobbyMode = keyof typeof ARENA_LOBBY_MODES;
export const ARENA_LOBBY_MODE_ORDER: readonly ArenaLobbyMode[] = ["carnet", "jouer", "classement"];
