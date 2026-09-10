export const ARENA_LOBBY_MODES = {
  carnet: {
    number: "01", name: "Le Carnet", label: "Déguste. Note. Collectionne.",
    description: "Tes dégustations ont du pouvoir.",
    href: "/arene/carnet/regular", action: "Ouvrir mon Carnet", frequency: 330,
    image: "/contest/mascot/arena-scene-carnet-v1.png",
    imageAlt: "Sylvain note sa dégustation dans son carnet, à la lumière de son bureau.",
  },
  jouer: {
    number: "02", name: "Le Placard", label: "Cultive. Affronte. Recommence.",
    description: "À toi de faire pousser ta réputation.",
    href: "/arene/placard", action: "Entrer dans le Placard", frequency: 440,
    image: "/contest/mascot/arena-scene-placard-v1.png",
    imageAlt: "Sylvain lance deux dés devant son atelier de culture éclairé.",
  },
  classement: {
    number: "03", name: "Le Classement", label: "Fais-toi un nom.",
    description: "La prochaine place à prendre est la tienne.",
    href: "/arene?vue=classement", action: "Voir les classements", frequency: 550,
    image: "/contest/mascot/arena-scene-classement-v1.png",
    imageAlt: "Sylvain présente un trophée doré sur le podium de l’Arène.",
  },
} as const;

export type ArenaLobbyMode = keyof typeof ARENA_LOBBY_MODES;
export const ARENA_LOBBY_MODE_ORDER: readonly ArenaLobbyMode[] = ["carnet", "jouer", "classement"];
