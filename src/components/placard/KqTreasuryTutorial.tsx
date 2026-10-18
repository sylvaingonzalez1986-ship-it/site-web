"use client";

import { useEffect, useState } from "react";
import { createKqTreasuryTutorial, type KqTreasuryTutorialLesson, type KqTreasuryTutorialProgress } from "@/lib/kanab-quest-treasury-tutorial";
import { createKqTutorialApi, KqTutorialApiProvider } from "./KqTutorialApiContext";
import { KqTreasuryDesk } from "./KqTreasuryDesk";
import { KqMarketDesk, type KqMarketSection } from "./KqMarketDesk";
import styles from "./KqTreasuryTutorial.module.css";

export function KqTreasuryTutorial({ lesson, onProgress, onOpenShop }: {
  lesson: KqTreasuryTutorialLesson;
  onProgress?: (progress: KqTreasuryTutorialProgress) => void;
  onOpenShop?: () => void;
}) {
  const [sandbox] = useState(() => createKqTreasuryTutorial());
  const [api] = useState(() => createKqTutorialApi(sandbox.request));
  const [notice, setNotice] = useState("");
  const [businessLocation, setBusinessLocation] = useState<"market" | "accounting">("market");
  const [marketSection, setMarketSection] = useState<KqMarketSection>("management");
  useEffect(() => {
    const update = () => onProgress?.(sandbox.progress(lesson));
    update();
    return sandbox.subscribe(update);
  }, [lesson, onProgress, sandbox]);
  const openShop = onOpenShop ?? (() => setNotice("L’ordinateur est déjà prêté. Retrouve les achats de matériel dans l’atelier Entrepôt du didacticiel."));
  const businessAtMarket = lesson === "business" && businessLocation === "market";
  const locationName = lesson !== "business" ? "Banque" : businessAtMarket ? "Marché" : "Bureau";
  return <KqTutorialApiProvider api={api}>
    <section data-treasury-tutorial={lesson} aria-label={`${locationName} du didacticiel`}>
      {lesson === "business" ? <nav className={styles.navigation} aria-label="Espaces de cet essai de gestion"><button type="button" aria-pressed={businessAtMarket} onClick={() => { setBusinessLocation("market"); setMarketSection("management"); }}>Marché · Gérer mon activité</button><button type="button" aria-pressed={!businessAtMarket} onClick={() => setBusinessLocation("accounting")}>Bureau · Comptabilité</button></nav> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {businessAtMarket ? <KqMarketDesk section={marketSection} onSectionChange={setMarketSection} onOpenShop={openShop}
        onOpenTreasury={() => setBusinessLocation("accounting")}
        onOpenStorage={() => setNotice("Retrouve tes contenants dans l’atelier Stockage & curing du didacticiel.")} />
        : <KqTreasuryDesk key={`${lesson}-${businessLocation}`} initialPole={lesson === "business" ? "accounting" : "bank"}
        initialBankDesk={lesson === "investments" ? "stocks" : "loans"}
        onOpenShop={openShop} />}
    </section>
  </KqTutorialApiProvider>;
}
