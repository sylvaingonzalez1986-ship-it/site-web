export type KqPlacardHubDestination = "game" | "arena" | "market" | "shop";

export type KqPlacardNextAction = {
  destination: KqPlacardHubDestination;
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
};

export function getKqPlacardNextAction(input: {
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  equipmentGoalAffordable: boolean;
}): KqPlacardNextAction {
  if (input.activeRun) {
    return {
      destination: "game",
      eyebrow: "Culture en cours",
      title: "Reprends là où tu t’es arrêté",
      description: "Ta partie officielle est sauvegardée. Termine la prochaine étape avant de préparer une autre culture.",
      buttonLabel: "Reprendre",
    };
  }
  if (input.readyLotCount > 0) {
    return {
      destination: "market",
      eyebrow: "Décision en attente",
      title: `${input.readyLotCount} lot${input.readyLotCount > 1 ? "s" : ""} à valoriser`,
      description: "Le jury a rendu son verdict. Choisis maintenant entre vente brute, transformation ou biomasse.",
      buttonLabel: "Ouvrir le comptoir",
    };
  }
  if (input.availableFlowerCount > 0) {
    return {
      destination: "arena",
      eyebrow: "Fleur disponible",
      title: "Trouve un rival et demande le verdict",
      description: `${input.availableFlowerCount} Fleur${input.availableFlowerCount > 1 ? "s sont prêtes" : " est prête"} à passer devant le jury.`,
      buttonLabel: "Choisir un rival",
    };
  }
  if (input.equipmentGoalAffordable) {
    return {
      destination: "shop",
      eyebrow: "Budget atteint",
      title: "Ton prochain équipement est accessible",
      description: "Investis maintenant pour renforcer les prochaines récoltes et débloquer de nouveaux débouchés.",
      buttonLabel: "Voir le matériel",
    };
  }
  return {
    destination: "game",
    eyebrow: "Prochaine récolte",
    title: "Lance une nouvelle culture",
    description: "Choisis ton mode de culture, ton Buddie et ta Botte, puis construis un lot assez bon pour ta réputation.",
    buttonLabel: "Préparer la culture",
  };
}
