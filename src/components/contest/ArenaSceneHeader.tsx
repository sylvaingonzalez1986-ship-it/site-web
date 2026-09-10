import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, Gamepad2, Trophy } from "lucide-react";
import { ARENA_LOBBY_MODES, ARENA_LOBBY_MODE_ORDER, type ArenaLobbyMode } from "@/lib/arena-lobby";
import styles from "./ArenaSceneHeader.module.css";

const icons = { carnet: BookOpen, jouer: Gamepad2, classement: Trophy };
const labels = { carnet: "Dégustation", jouer: "Placard", classement: "Classement" };

export function ArenaSceneHeader({ mode, title, description, isPlacardPlayerEnabled = true }: {
  mode: ArenaLobbyMode;
  title?: string;
  description?: string;
  isPlacardPlayerEnabled?: boolean;
}) {
  const scene = ARENA_LOBBY_MODES[mode];
  return (
    <header className={styles.header} data-arena-scene={mode}>
      <Image src={scene.image} alt="" fill priority sizes="100vw" className={styles.art} />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.inner}>
        <Link href="/arene" className={styles.back}><ArrowLeft size={18} aria-hidden="true" /> L’Arène</Link>
        <div className={styles.copy}>
          <span>Kanab Quest · Mode {scene.number}</span>
          <h1>{title ?? scene.name}</h1>
          <p>{description ?? scene.label}</p>
        </div>
        <nav className={styles.modes} aria-label="Espaces de l’Arène">
          {ARENA_LOBBY_MODE_ORDER.filter((id) => id !== "jouer" || isPlacardPlayerEnabled).map((id) => {
            const Icon = icons[id];
            return <Link key={id} href={ARENA_LOBBY_MODES[id].href} aria-current={mode === id ? "page" : undefined}>
              <Icon size={20} aria-hidden="true" /><span>{labels[id]}</span>
            </Link>;
          })}
        </nav>
      </div>
    </header>
  );
}
