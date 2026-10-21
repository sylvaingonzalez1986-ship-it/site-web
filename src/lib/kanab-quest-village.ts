import type { KqPlacardNextAction } from "./kanab-quest-hub";

/** Keep Sylvain's reply tied to the next action, without inventing a visit history. */
export function getKqVillageWelcome(action: KqPlacardNextAction) {
  const reply = action.destination === "arena"
    ? "Tes Fleurs ont quitté l’atelier. Voyons ce que le jury reconnaît dans ton travail."
    : action.destination === "market"
      ? "Le verdict est là. Au comptoir, prends le temps de comparer ce que ton lot peut devenir."
      : action.eyebrow === "Culture en cours"
        ? "Les manches retroussées, on reprend ? Ta culture est sauvegardée, à toi de jouer la suite."
        : action.destination === "shop"
          ? "Il y a de quoi faire évoluer l’atelier. Garde aussi de quoi mener ta prochaine culture."
          : "Les clés sont à toi. Choisis ton Buddie : c’est ta façon de cultiver qui fera vivre ce coin de Bretagne.";

  return { reply };
}
