import Link from "@/components/navigation/NavigationLink";
import { ArrowRight, CalendarDays, ShoppingBag } from "lucide-react";
import { KqPrintedArt } from "@/components/placard/KqPrintedArt";
import { ARENA_OPENING_MESSAGE } from "@/lib/arena-opening";
import styles from "./HomeRewardsSection.module.css";

export function HomeRewardsSection({ arenaPrelaunch }: { arenaPrelaunch: boolean }) {
  return (
    <section id="ticket-grattage-home" className={styles.section} aria-labelledby="bonus-title" data-tutorial="ticket-promo-band">
      <div className="retro-container">
        <header className={styles.heading}>
          <p className={styles.kicker}>Le petit plus du Quartier</p>
          <h2 id="bonus-title">Tes avis, du jeu.<span>Et des cadeaux.</span></h2>
          <p className={styles.lead}>Partage tes découvertes dans le Carnet, fais grandir ton activité dans le jeu et complète ton album. À chaque aventure, ses récompenses.</p>
        </header>

        <article className={styles.draw} aria-labelledby="home-draw-title">
          <div className={styles.prize}>
            <p className={styles.eyebrow}>Le tirage du Carnet</p>
            <p className={styles.grams}>10 <span>g</span></p>
            <p className={styles.prizeLabel}>de fleurs CBD à gagner</p>
            <div className={styles.calendar}><CalendarDays size={23} aria-hidden="true" /><p><strong>Chaque 1er du mois</strong><span>Un gagnant · une chance par joueur</span></p></div>
          </div>
          <div className={styles.drawCopy}>
            <p className={styles.eyebrow}>01 · Tes dégustations récompensées</p>
            <h3 id="home-draw-title">Un avis validé.<br />Une chance chaque mois.</h3>
            <p>Note une fleur que tu as achetée. Dès qu’au moins un de tes avis est validé, ton compte participe automatiquement aux tirages mensuels.</p>
            <ol className={styles.steps} aria-label="Les étapes pour participer">
              <li><span aria-hidden="true">1</span>Une fleur achetée</li>
              <li><span aria-hidden="true">2</span>Ton avis validé</li>
              <li><span aria-hidden="true">3</span>Tu participes chaque mois</li>
            </ol>
            <p className={styles.reminder}><strong>Tes anciens avis comptent aussi.</strong> Une seule chance par compte, quel que soit le nombre d’avis ou la note donnée.</p>
            <p className={styles.claim}><ShoppingBag size={20} aria-hidden="true" /><span>Si tu gagnes, sélectionne tes <strong>10 g offerts dans le panier, lors d’une commande.</strong></span></p>
            <Link href="/arene/carnet/regular" className={styles.action}>Noter mes fleurs <ArrowRight size={19} aria-hidden="true" /></Link>
            <details className={styles.rules}>
              <summary>Les conditions du tirage</summary>
              <p>Les avis Regular et Concours comptent, même anciens. Il faut au moins un avis validé sur une fleur achetée et payée, non annulée, avant 00 h le 1er du mois, heure de Paris. Les avis en attente ou refusés ne comptent pas.</p>
              <p>Le lot est à utiliser avec une commande payée : choisis le bon dans « Bon / cadeau », puis « Utiliser ». Il n’est pas cumulable avec un code promo. Les fleurs sont jointes à cette commande, sans expédition automatique.</p>
            </details>
          </div>
        </article>

        <div className={styles.activities}>
          <article className={styles.card} aria-labelledby="home-game-title">
            <div className={styles.cardHeading}>
              <div><p className={styles.eyebrow}>02 · Kanab Quest, le jeu du Quartier</p><h3 id="home-game-title">Cultive. Entreprends.<br />Fais-toi un nom.</h3></div>
              <KqPrintedArt kind="quarter" className={styles.art} sizes="(max-width: 600px) 74px, 120px" />
            </div>
            <p>Cultive, récolte, vends et développe ton entreprise virtuelle. Tes dégustations, tes duels et ton activité font progresser ton classement.</p>
            <div className={styles.rewardLine}>
              <strong>Le Pot de la Canopée</strong>
              <p>En fin de saison, des fleurs récompensent les joueurs éligibles du Top 10 et un joueur tiré au sort parmi les éligibles hors Top 10.</p>
            </div>
            {arenaPrelaunch && <p className={styles.opening}>{ARENA_OPENING_MESSAGE} pour le jeu.</p>}
            <div className={styles.cardActions}>
              <Link href={arenaPrelaunch ? "/arene" : "/arene/placard"} className={styles.action}>{arenaPrelaunch ? "Découvrir le jeu" : "Entrer dans le Quartier"} <ArrowRight size={19} aria-hidden="true" /></Link>
              <Link href="/arene?vue=classement" className={styles.textLink}>Voir le classement et ses récompenses</Link>
            </div>
            <details className={styles.rules}>
              <summary>Comment sont attribués les lots ?</summary>
              <p>Le montant des lots dépend du pot de la saison. Pour être éligible, il faut au moins une dégustation validée dans la saison ou trois duels humains. Le classement tient aussi compte du développement de ton entreprise.</p>
              <p>Les fleurs gagnées sont à réclamer lors d’une commande. Ce classement de saison et le tirage mensuel du Carnet sont deux récompenses distinctes.</p>
            </details>
          </article>

          <article className={styles.card} aria-labelledby="home-album-title">
            <div className={styles.cardHeading}>
              <div><p className={styles.eyebrow}>03 · Mon Album, les boosters</p><h3 id="home-album-title">Collectionne les cartes.<br />Débloque des cadeaux.</h3></div>
              <KqPrintedArt kind="collection" className={styles.art} sizes="(max-width: 600px) 74px, 120px" />
            </div>
            <p>Tes commandes payées te donnent des boosters de <strong>3 cartes</strong>. Complète les pages de ton album ou recycle tes doublons pour obtenir des récompenses.</p>
            <div className={styles.rewardLine}>
              <strong>Page Légendaire complète : 600 € en bons d’achat</strong>
              <p>12 bons de 50 €, à raison d’un par mois pendant 12 mois. Hors frais de port.</p>
            </div>
            <div className={styles.cardActions}>
              <Link href="/profil/collection" className={styles.action}>Ouvrir mon album <ArrowRight size={19} aria-hidden="true" /></Link>
              <Link href="/reglement-jeu-promo" className={styles.textLink}>Voir le règlement des boosters</Link>
            </div>
            <details className={styles.rules}>
              <summary>Boosters, pages et doublons</summary>
              <p>Le nombre de packs reçus dépend du montant de ta commande payée, du plafond par commande et de tes éventuels bonus fidélité.</p>
              <p>Une page complète débloque sa récompense. Tu peux aussi recycler 10 doublons identiques contre une récompense proposée dans l’album. Les bons et cadeaux obtenus s’utilisent lors d’une commande, selon leurs conditions.</p>
            </details>
          </article>
        </div>
      </div>
    </section>
  );
}
