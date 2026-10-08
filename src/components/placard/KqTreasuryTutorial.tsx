"use client";

import { useEffect, useState } from "react";
import { createKqTreasuryTutorial, type KqTreasuryTutorialLesson, type KqTreasuryTutorialProgress } from "@/lib/kanab-quest-treasury-tutorial";
import { createKqTutorialApi, KqTutorialApiProvider } from "./KqTutorialApiContext";
import { KqTreasuryDesk } from "./KqTreasuryDesk";

export function KqTreasuryTutorial({ lesson, onProgress, onOpenShop, onOpenMarket }: {
  lesson: KqTreasuryTutorialLesson;
  onProgress?: (progress: KqTreasuryTutorialProgress) => void;
  onOpenShop?: () => void;
  onOpenMarket?: () => void;
}) {
  const [sandbox] = useState(() => createKqTreasuryTutorial());
  const [api] = useState(() => createKqTutorialApi(sandbox.request));
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const update = () => onProgress?.(sandbox.progress(lesson));
    update();
    return sandbox.subscribe(update);
  }, [lesson, onProgress, sandbox]);
  return <KqTutorialApiProvider api={api}>
    <section data-treasury-tutorial={lesson} aria-label="Bureau du didacticiel">
      <p role="note"><strong>Bureau d’essai.</strong> 5 000 € fictifs, personnage Trésorier et ordinateur prêtés. Les opérations restent dans cet atelier. Cours de démonstration fixes à 100 € ; aucun cours réel n’est consulté.</p>
      {notice ? <p role="status">{notice}</p> : null}
      <KqTreasuryDesk key={lesson} initialPole={lesson === "business" ? "management" : "bank"}
        initialBankDesk={lesson === "investments" ? "stocks" : "loans"}
        onOpenShop={onOpenShop ?? (() => setNotice("L’ordinateur est déjà prêté. Retrouve les achats de matériel dans l’atelier Entrepôt du didacticiel."))}
        onOpenMarket={onOpenMarket ?? (() => setNotice("Retrouve les récoltes et leurs débouchés dans l’atelier Transformation et vente du didacticiel."))} />
    </section>
  </KqTutorialApiProvider>;
}
