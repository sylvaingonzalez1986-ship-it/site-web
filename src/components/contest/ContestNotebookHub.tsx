import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sprout } from "lucide-react";
import styles from "@/components/contest/ContestArena.module.css";

const NOTEBOOK_DESTINATIONS = [
  {
    href: "/arene/carnet/regular",
    title: "Carnet Regular",
    description: "Retrouve les fleurs habituelles, consulte leurs fiches et conserve tes notes de dégustation.",
    image: "/contest/mascot/tasting/tasting-start.png",
    tone: "regular",
  },
  {
    href: "/arene/carnet/concours",
    title: "Carnet Concours",
    description: "Goûte les fleurs en compétition, publie tes critiques et débloque tes récompenses.",
    image: "/contest/mascot/flower-inspector.png",
    tone: "concours",
  },
  {
    href: "/arene/carnet/classement",
    title: "Classement des fleurs",
    description: "Compare les fleurs à partir des notes validées dans les carnets.",
    image: "/contest/mascot/leaderboard-judge.png",
    tone: "classement",
  },
] as const;

export function ContestNotebookHub({ isPlacardPlayerEnabled }: { isPlacardPlayerEnabled: boolean }) {
  return (
    <main data-world="arena" data-surface="notebook-hub" className={styles.page}>
      <header className={styles.notebookSurfaceHeader}>
        <nav aria-label="Navigation du Carnet">
          <Link href="/arene"><ChevronLeft aria-hidden="true" /> L’Arène</Link>
          <strong>Mon Carnet</strong>
          {isPlacardPlayerEnabled ? (
            <Link href="/arene/placard" className={styles.notebookSurfacePlay}>
              Jouer <Sprout aria-hidden="true" />
            </Link>
          ) : <span />}
        </nav>
      </header>

      <section className={styles.notebookHub} aria-labelledby="notebook-hub-title">
        <header className={styles.notebookHubIntro}>
          <span>
            <h1 id="notebook-hub-title">Mon Carnet</h1>
            <p>Choisis l’espace que tu veux ouvrir.</p>
          </span>
          <Image
            src="/contest/mascot/tasting/tasting-start.png"
            alt="Mascotte du Carnet de dégustation"
            width={408}
            height={771}
            priority
            sizes="(max-width: 700px) 82px, 130px"
          />
        </header>

        <nav className={styles.notebookHubGrid} aria-label="Espaces du Carnet">
          {NOTEBOOK_DESTINATIONS.map(({ href, title, description, image, tone }, index) => (
            <Link key={href} href={href} data-tone={tone}>
              <span className={styles.notebookHubArtwork}>
                <Image src={image} alt="" fill sizes="(max-width: 767px) 110px, 260px" />
                <b>{index + 1}</b>
              </span>
              <span className={styles.notebookHubCardCopy}>
                <strong>{title}</strong>
                <p>{description}</p>
                <em>Ouvrir <ChevronRight aria-hidden="true" /></em>
              </span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
