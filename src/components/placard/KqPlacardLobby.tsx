"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Banknote, Gamepad2, ShoppingBag, Swords } from "lucide-react";
import { useState } from "react";
import { KqPlacardHud } from "./KqPlacardHud";
import styles from "./KqPlacardLobby.module.css";

const DESTINATIONS = [
  { id: "game", title: "La culture", action: "Entrer dans le jeu", detail: "Prépare ton atelier, lance les dés et fais grandir ta prochaine récolte.", image: "/contest/mascot/arena-scene-placard-v1.png", icon: Gamepad2 },
  { id: "market", title: "L’atelier du marché", action: "Ouvrir le marché", detail: "Choisis une machine, transforme ton lot et réinvestis tes gains.", image: "/placard/market-workshop-v1.webp", icon: Banknote },
  { id: "shop", title: "La boutique", action: "Entrer dans la boutique", detail: "Équipe ton placard et découvre les boosters de ta collection.", image: "/placard/booster-shop-interior-v4.webp", icon: ShoppingBag },
  { id: "arena", title: "Fleur vs Fleur", action: "Préparer un duel", detail: "Présente ta fleur au jury et affronte les récoltes des autres joueurs.", image: "/contest/mascot/arena-duo.webp", icon: Swords },
] as const;

export function KqPlacardLobby({ onOpen, onOpenEquipment }: {
  onOpen: (view: "game" | "market" | "shop" | "arena") => void;
  onOpenEquipment: (equipmentCode?: string) => void;
}) {
  const [selected, setSelected] = useState<(typeof DESTINATIONS)[number]["id"]>("game");
  const destination = DESTINATIONS.find((item) => item.id === selected)!;
  return <main className={styles.lobby}>
    <div className={styles.backdrop} data-mode={selected} aria-hidden="true">
      <Image key={destination.image} src={destination.image} alt="" fill sizes="100vw" priority />
    </div>
    <header className={styles.header}><Link href="/arene"><ArrowLeft size={18} /> L’Arène</Link><span>Culture · Atelier · Duels</span><h1>Le Placard</h1></header>
    <section className={styles.dock} aria-label="Choisir une activité du Placard">
      <div className={styles.description} aria-live="polite"><span>À toi de jouer</span><h2>{destination.title}</h2><p>{destination.detail}</p></div>
      <nav className={styles.menu} aria-label="Activités du Placard">{DESTINATIONS.map((item) => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><item.icon size={22} aria-hidden="true" /><span>{item.id === "market" ? "Marché" : item.id === "game" ? "Culture" : item.id === "shop" ? "Boutique" : "Duels"}</span></button>)}</nav>
      <button className={styles.enter} type="button" onClick={() => onOpen(selected)}>{destination.action}<ArrowRight size={21} aria-hidden="true" /></button>
      <details className={styles.progress}><summary>Mon atelier & ma progression</summary><KqPlacardHud onOpenShop={onOpenEquipment} onOpenGame={() => onOpen("game")} onOpenArena={() => onOpen("arena")} onOpenMarket={() => onOpen("market")} /></details>
    </section>
  </main>;
}
