import type { ArenaLessonProgress, ArenaPlayableLessonId } from "./arena-playable-learning";
import type { ReleveGuideStep } from "./arena-releve-guide";
import { getNotebookLessonGuide } from "./arena-notebook-lesson-guide";

/** Contextual pointers for the real screens opened from Sylvain's meetings. */
export function getReleveLessonGuide(lesson: ArenaPlayableLessonId, progress: ArenaLessonProgress, acknowledged: readonly string[] = []): ReleveGuideStep[] {
  if (!["bank", "investments", "specialties", "missions", "notebook", "collection"].includes(lesson)) return [];
  if (progress.complete) return [{ id: `${lesson}:complete`, title: "Cette découverte est réussie", instruction: lesson === "notebook" ? "Ta fiche d’entraînement est terminée. Retrouve ton Carnet pour noter tes propres dégustations." : "Tu as essayé les commandes de cet espace. Clique pour retrouver Sylvain et la suite de l'histoire.", selector: "[data-releve-finish-lesson]", kind: "button" }];
  if (lesson === "notebook") return getNotebookLessonGuide(acknowledged);

  const steps: ReleveGuideStep[] = [];
  const add = (id: string, title: string, instruction: string, target: { selector?: string; text?: string; scope?: string; kind?: ReleveGuideStep["kind"] }) => {
    steps.push({ id: `${lesson}:${id}`, title, instruction, kind: "button", ...target });
  };

  if (lesson === "bank") {
    const saving = progress.instruction.includes("capital est arrivé") || progress.instruction.includes("dépôt est enregistré");
    const withdrawing = progress.instruction.includes("dépôt est enregistré");
    if (!saving) {
      add("sign", "Lis ton contrat avant de signer", "Compare le capital reçu, le coût et les sept échéances. Si ce contrat te convient, signe pour recevoir les euros fictifs.", { text: "Signer et recevoir le capital", scope: 'dialog[aria-labelledby="bank-contract-title"]' });
      add("contract", "Quel budget veux-tu emprunter ?", "Le montant proposé est modifiable. Clique pour examiner son contrat avant de t'engager dans cet essai.", { text: "Examiner le contrat", scope: "#bank-panel-loans" });
      add("amount", "Choisis un montant dans la limite indiquée", "Saisis par exemple 1 000 dans ce champ. Le guichet affichera ensuite le coût et les échéances du prêt fictif.", { selector: "#bank-loan-amount", kind: "input" });
      add("loans", "Rencontrons le banquier", "Ouvre le guichet des prêts pour choisir un montant et examiner un contrat.", { selector: '#bank-desk-loans[aria-selected="false"]' });
    } else {
      const scope = "#bank-panel-savings";
      add(withdrawing ? "withdraw" : "deposit", withdrawing ? "Retrouve ton disponible" : "Mets une réserve de côté", withdrawing ? "Clique pour retirer le montant saisi. L'argent reviendra dans ta trésorerie d'essai." : "Clique pour déposer le montant saisi sur le livret d'essai. Observe la différence entre ton disponible et ton épargne.", { text: withdrawing ? "Retirer" : "Déposer", scope });
      add(withdrawing ? "withdraw-amount" : "deposit-amount", withdrawing ? "Essaie un petit retrait" : "Prépare ton premier dépôt", withdrawing ? "Saisis 50 € ou une somme inférieure à ton épargne, puis choisis Retirer." : "Saisis 100 € pour cet essai, puis choisis Déposer. Ce livret est l'avantage de la spécialité Trésorier.", { selector: '#bank-panel-savings input[inputmode="decimal"]', kind: "input" });
      add("savings", "Ouvre ton livret", "Le prêt est enregistré. Passe au livret d'épargne pour essayer un dépôt et un retrait avec ce budget fictif.", { selector: '#bank-desk-savings[aria-selected="false"]' });
    }
    return steps;
  }

  if (lesson === "investments") {
    const selling = progress.instruction.includes("Mes positions");
    const crypto = progress.instruction.includes("guichet Crypto");
    const market = crypto ? "crypto" : "stock";
    const orderScope = `#${market}-order-dialog`;
    add("confirm", selling ? "Vérifie la somme à recevoir" : "Vérifie le montant à débiter", "Lis la quantité, le prix bloqué et le total. Confirme seulement l'ordre que tu souhaites essayer avec les euros de jeu.", { selector: `[data-${market}-confirm]`, scope: orderScope });
    add("expired", "L'offre doit être actualisée", "Cette offre a expiré. Reviens à sa préparation pour obtenir un montant à confirmer.", { selector: `${orderScope}:has([data-expired="true"]) button`, text: "Modifier l’ordre" });
    add("empty-amount", "Le montant reste à renseigner", selling ? "Indique la quantité à revendre. Elle doit être supérieure à zéro et ne pas dépasser ta position." : "Saisis par exemple 100 € de jeu avant de préparer l'offre.", { selector: `#${market}-order-amount[value=""]`, kind: "input" });
    add("prepare", "Prépare une offre sans l'exécuter", selling ? "La quantité de ta position est proposée. Tu peux la réduire, puis préparer l'offre pour voir combien tu recevras." : "Vérifie ou ajuste le montant en euros de jeu, puis prépare l'offre. L'achat attendra encore ta confirmation.", { selector: `${orderScope} form button[type="submit"]` });
    add("amount", "Choisis le montant de ton essai", selling ? "Indique la quantité à revendre, sans dépasser ta position." : "Saisis par exemple 100 € de jeu. Le cours fixe de cet exercice ne prédit aucun rendement.", { selector: `#${market}-order-amount`, kind: "input" });
    if (crypto) {
      add("buy-crypto", "Découvre le deuxième portefeuille", "Choisis Acheter sur une crypto de démonstration. Nous préparerons puis confirmerons l'ordre comme en Bourse.", { selector: '[data-testid="crypto-market"] button[aria-label^="Acheter "]' });
      add("crypto-market", "Retrouve les actifs disponibles", "Le portefeuille affiche tes positions. Reviens au marché pour choisir la crypto de ton achat d'essai.", { selector: '#crypto-market-tab[aria-selected="false"]' });
      add("crypto-tab", "Passe au guichet Crypto", "Ton achat et ta vente en Bourse sont enregistrés. Ouvre le guichet Crypto pour découvrir son portefeuille séparé.", { selector: '#bank-desk-crypto[aria-selected="false"]' });
    } else if (selling) {
      add("sell", "Revends ta position d'essai", "Clique sur Vendre pour préparer la cession de tout ou partie de ce titre. Tu vérifieras le total avant confirmation.", { selector: '[data-testid="stocks-market"] button[aria-label^="Vendre "]' });
      add("positions", "Retrouve ce que tu détiens", "Ouvre Mes positions. Tu y verras la quantité achetée, son coût et sa valeur dans cet exercice.", { selector: '#stock-portfolio-tab[aria-selected="false"]' });
      add("stocks-tab", "Reviens au portefeuille boursier", "Ouvre la Bourse, puis Mes positions pour essayer une vente.", { selector: '#bank-desk-stocks[aria-selected="false"]' });
    } else {
      add("buy-stock", "Choisis un titre pour apprendre", "Clique sur Acheter. Tous les cours de cet essai sont fixes à 100 € : l'objectif est de comprendre les commandes et les montants.", { selector: '[data-testid="stocks-market"] button[aria-label^="Acheter "]' });
      add("stock-market", "Retrouve les titres disponibles", "Reviens aux titres du CAC 40 pour préparer ton premier achat fictif.", { selector: '#stock-cac40-tab[aria-selected="false"]' });
      add("stocks-tab", "Ouvre le comptoir boursier", "Nous allons préparer un achat fictif, vérifier son total, puis le confirmer.", { selector: '#bank-desk-stocks[aria-selected="false"]' });
    }
    return steps;
  }

  if (lesson === "specialties") {
    const scope = "[data-chanvrier-profile]";
    add("strength", "Essaie l'avantage du Trésorier", "Compare les quatre spécialités. Pour cet exemple, sélectionne Trésorier et lis son avantage ; tu peux choisir celle qui te plaît.", { selector: 'button[aria-pressed="false"]', text: "Trésorier", scope });
    add("create", "Enregistre ton personnage d'essai", "Vérifie la spécialité et son avantage, puis crée ce personnage fictif. Le profil de ton compte reste le même.", { text: "Créer mon chanvrier", scope });
    add("look", "Ton personnage prend forme", "Choisis ton surnom, puis essaie les visages, coiffures et tenues. Quand il te plaît, passe au choix de sa force.", { text: "Choisir ma force", scope });
    add("nickname", "Comment s'appelle ton personnage ?", "Saisis un surnom de 3 à 24 caractères, par exemple Apprenti. Tu peux ensuite personnaliser son apparence avant de choisir sa spécialité.", { selector: 'input[autocomplete="nickname"]', kind: "input", scope });
    return steps;
  }

  if (lesson === "collection") {
    const scope = '[data-playable-discovery="collection"]';
    add("album", "Range tes trois cartes", "Tes cartes ont été révélées. Range-les dans l'album d'essai pour les retrouver ensemble.", { text: "Ranger dans mon album", scope });
    add("loot", "Regarde ce que tu as découvert", "Les trois cartes sont révélées. Clique pour les voir ensemble avant de les ranger.", { text: "Voir mon butin", scope });
    add("reveal", "Retourne cette carte", "Clique sur la carte pour découvrir le Buddie et sa rareté. Nous allons ouvrir les trois cartes du pack.", { selector: 'button[data-card-revealed="false"]', scope });
    add("next", "Une autre carte t'attend", "Passe à la carte suivante, puis retourne-la pour poursuivre l'ouverture.", { text: "Carte suivante", scope });
    add("pack", "Ouvre ton premier pack", "Clique pour ouvrir le pack préparé par Sylvain. L'animation te laissera ensuite révéler chaque carte toi-même.", { text: "Ouvrir le pack", scope });
    add("pack-tab", "Retrouve le pack prêté", "Reviens à Mon pack pour ouvrir ses trois cartes avant de les ranger dans ton album.", { text: "Mon pack", selector: 'button[aria-pressed="false"]', scope });
    return steps;
  }

  if (lesson === "missions") {
    add("open-reward", "Ouvre la récompense récupérée", "Le reçu confirme ton pack. Ouvre-le ici pour découvrir les cartes obtenues dans cet essai.", { text: "Ouvrir mon pack", scope: "[data-mission-receipt]" });
    add("claim", "Une mission accomplie attend sa récompense", "Le Jardin des connaisseurs est déjà accompli dans ce dossier. Clique pour récupérer son pack ; terminer un objectif et récupérer sa récompense sont deux actions distinctes.", { text: "Récupérer mon pack", scope: '[data-playable-discovery="missions"]' });
    add("challenges", "Regarde tes défis", "Ouvre Mes défis pour retrouver le parcours Culture et sa récompense disponible.", { text: "Mes défis", selector: 'button[aria-pressed="false"]', scope: '[aria-label="Parcours des missions"]' });
    add("all-tracks", "Retrouve le parcours Culture", "Affiche tous les parcours pour repérer le défi du Jardin des connaisseurs et récupérer son pack.", { text: "Tous les parcours", selector: 'button[aria-pressed="false"]', scope: '[data-playable-discovery="missions"]' });
    return steps;
  }

  return steps;
}
