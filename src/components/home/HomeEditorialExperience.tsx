import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  FlaskConical,
  Heart,
  Leaf,
  MapPin,
  Scale,
  ShieldCheck,
  Sprout,
  UsersRound,
} from "lucide-react";
import { ContactEmailButton } from "@/components/ContactEmailButton";
import { CustomSection } from "@/components/CustomSection";
import { ProductCard } from "@/components/ProductCard";
import { HomeBadgePromoBand } from "@/components/home/HomeBadgePromoBand";
import { HomeSeasonGallery } from "@/components/home/HomeSeasonGallery";
import { CBD_NATUREL_CANONICAL_ANSWER } from "@/lib/cbd-natural-answer";
import { sortOwnProductsFirst } from "@/lib/own-producer";
import type { HomeSection, PublicStoreResponse } from "@/types/store";
import styles from "./HomeEditorialExperience.module.css";

type HomeEditorialExperienceProps = {
  initialStore: PublicStoreResponse;
};

const sellingPoints = [
  {
    icon: Sprout,
    title: "Direct producteur",
    text: "Notre production bretonne et celle de nos copains français, sans intermédiaire inutile.",
  },
  {
    icon: FlaskConical,
    title: "Traçabilité lisible",
    text: "Origine, producteur, composition et analyses disponibles clairement présentés.",
  },
  {
    icon: Scale,
    title: "On vend juste",
    text: "Pas de prix gonflés ni de fausses promotions : le bon prix, dès le premier gramme.",
  },
] as const;

const philosophy = [
  { icon: Scale, label: "Un prix juste", detail: "dès 1 gramme" },
  { icon: Leaf, label: "Des origines", detail: "producteurs identifiés" },
  { icon: MapPin, label: "Du local", detail: "breton et français" },
  { icon: Heart, label: "Du respect", detail: "pas du blabla" },
] as const;

function isSectionVisible(sections: HomeSection[], type: string) {
  const section = sections.find((candidate) => candidate.type === type);
  return section?.visible !== false;
}

export function HomeEditorialExperience({ initialStore }: HomeEditorialExperienceProps) {
  const { content, products, sections } = initialStore;
  const home = content.home;
  const homeSections = sections.home;
  const featuredProducts = sortOwnProductsFirst(products).slice(0, 3);
  const customSections = homeSections.filter(
    (section): section is Extract<HomeSection, { type: "custom" }> =>
      section.type === "custom" && section.visible,
  );

  const shopLabel = home.heroPrimaryCtaLabel.trim() || "Voir le marché";

  return (
    <div className={styles.page}>
      <section className={styles.hero} data-tutorial="home-hero">
        <div className={styles.heroNoise} aria-hidden="true" />
        <div className={`retro-container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              Du CBD vrai.
              <span>Au prix juste.</span>
            </h1>

            <div className={styles.heroRule} aria-hidden="true" />

            <div className={styles.mobileHeroStage} aria-hidden="true">
              <span className={styles.mobileSun} />
              <span className={styles.mobilePriceStamp}>
                <strong>CBD</strong>
                <small>origine identifiée</small>
              </span>
              <Image
                src="/mascots/home-welcome.png"
                alt=""
                width={1122}
                height={1402}
                sizes="76vw"
                className={styles.mobileHeroMascot}
              />
            </div>

            <div className={styles.heroActions}>
              <Link href="/boutique" className={styles.primaryCta}>
                {shopLabel}
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link href="#notre-philosophie" className={styles.secondaryCta}>
                Notre philosophie
                <ArrowDownRight aria-hidden="true" />
              </Link>
            </div>

            <ul className={styles.heroProofs} aria-label="Nos engagements essentiels">
              <li><Check aria-hidden="true" /> Direct producteur</li>
              <li><Check aria-hidden="true" /> Analyses disponibles</li>
              <li><Check aria-hidden="true" /> Livraison France</li>
            </ul>
          </div>

          <div className={styles.heroStage} aria-label="Sylvain, producteur de chanvre breton">
            <span className={styles.priceStamp}>
              <strong>CBD</strong>
              <small>origine identifiée</small>
            </span>
            <span className={styles.sun} aria-hidden="true" />
            <span className={styles.heroScribble} aria-hidden="true">cultivé ici</span>
            <Image
              src="/mascots/home-welcome.png"
              alt="Sylvain, producteur de CBD naturel en Bretagne"
              width={1122}
              height={1402}
              priority
              sizes="(max-width: 767px) 82vw, 42vw"
              className={styles.heroMascot}
            />
          </div>
        </div>
      </section>

      {isSectionVisible(homeSections, "legal") && (
        <section className={styles.promise} aria-labelledby="prix-juste-title">
          <div className={`retro-container ${styles.promiseGrid}`}>
            <div className={styles.promiseHeading}>
              <p className={styles.kicker}>Pourquoi pas de prix dégressifs ?</p>
              <h2 id="prix-juste-title">
                Parce qu&apos;on pense aussi aux <span>petits budgets.</span>
              </h2>
              <p>
                Pourquoi payer plus cher son premier gramme simplement parce qu&apos;on ne peut
                pas en acheter cinquante ? Chez nous, le meilleur prix commence dès le début.
              </p>
            </div>

            <div className={styles.promiseMascotStage} aria-hidden="true">
              <span className={styles.thinkingHalo} />
              <Image
                src="/mascots/home-thinking.png"
                alt=""
                width={1122}
                height={1402}
                sizes="(max-width: 767px) 58vw, 24vw"
                className={styles.promiseMascot}
              />
            </div>

            <div className={styles.promiseList}>
              {sellingPoints.map(({ icon: Icon, title, text }, index) => (
                <article key={title} className={styles.promiseItem}>
                  <span className={styles.number}>0{index + 1}</span>
                  <span className={styles.roundIcon}><Icon aria-hidden="true" /></span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="notre-philosophie" className={styles.philosophy} aria-labelledby="philosophie-title">
        <div className={`retro-container ${styles.philosophyGrid}`}>
          <div>
            <p className={styles.kicker}>Simple comme bonjour</p>
            <h2 id="philosophie-title" className={styles.sectionTitle}>
              Notre <span>philosophie.</span>
            </h2>
            <div className={styles.checkList}>
              {philosophy.map(({ icon: Icon, label, detail }) => (
                <div key={label} className={styles.checkRow}>
                  <span className={styles.roundIcon}><Icon aria-hidden="true" /></span>
                  <p><strong>{label}.</strong> {detail}.</p>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.philosophyStage}>
            <span className={styles.greenDisc} aria-hidden="true" />
            <Image
              src="/mascots/home-philosophy.png"
              alt="Le producteur présente la philosophie des Chanvriers Bretons"
              width={1122}
              height={1402}
              sizes="(max-width: 767px) 60vw, 38vw"
              className={styles.philosophyMascot}
            />
            <p className={styles.handNote}>du clair, du français,<br />du traçable.</p>
          </div>
        </div>
      </section>

      <section className={styles.transparency} aria-labelledby="transparence-title">
        <div className={`retro-container ${styles.transparencyGrid}`}>
          <div className={styles.transparencyIllustration}>
            <Image
              src="/mascots/home-producer.png"
              alt="Producteur de chanvre présentant une récolte et son contrôle laboratoire"
              width={1122}
              height={1402}
              sizes="(max-width: 767px) 55vw, 31vw"
              className={styles.transparencyMascot}
            />
          </div>
          <div>
            <p className={styles.kicker}>Cultivé ici et chez nos collègues</p>
            <h2 id="transparence-title" className={styles.sectionTitle}>
              Notre récolte. <span>Et celle de producteurs qu&apos;on connaît.</span>
            </h2>
            <p className={styles.transparencyLead}>
              Des fleurs cultivées chez nous, en Bretagne, ou sélectionnées auprès de collègues
              producteurs français. Plusieurs terroirs, plusieurs profils, les mêmes exigences.
            </p>
            <div className={styles.transparencyPoints}>
              <p><ShieldCheck aria-hidden="true" /><span><strong>Traçabilité.</strong> Des origines claires et les analyses disponibles sur les fiches.</span></p>
              <p><UsersRound aria-hidden="true" /><span><strong>Circuit court.</strong> Nos produits, ceux de nos voisins et de producteurs français choisis.</span></p>
              <p><Leaf aria-hidden="true" /><span><strong>Transparence.</strong> Pas de marketing trompeur, simplement ce qu&apos;il y a dans le sachet.</span></p>
            </div>
          </div>
        </div>
      </section>

      {isSectionVisible(homeSections, "products") && (
        <section id="products" className={styles.products} aria-labelledby="produits-title">
          <div className="retro-container">
            <div className={styles.productsHeader}>
              <div>
                <p className={styles.kicker}>À découvrir maintenant</p>
                <h2 id="produits-title" className={styles.sectionTitle}>
                  Les produits du <span>moment.</span>
                </h2>
              </div>
              <Link href="/boutique" className={styles.textLink}>
                Tout voir <ArrowRight aria-hidden="true" />
              </Link>
            </div>

            {featuredProducts.length > 0 ? (
              <div className={styles.productGrid}>
                {featuredProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    addButtonLabel={home.productsAddButtonLabel.trim() || "Ajouter au panier"}
                    lowStockThresholdGrams={content.boutique.lowStockThresholdGrams}
                    imagePriority={index === 0}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyProducts}>
                Les récoltes arrivent bientôt. En attendant, découvre toute notre démarche.
              </div>
            )}
          </div>
        </section>
      )}

      <section
        id="ticket-grattage-home"
        className={styles.bonusIntro}
        aria-labelledby="bonus-title"
        data-tutorial="ticket-promo-band"
      >
        <div className={`retro-container ${styles.bonusGrid}`}>
          <div className={styles.bonusCopy}>
            <p className={styles.kicker}>Et en bonus ?</p>
            <h2 id="bonus-title">Du fun et des cadeaux.</h2>
            <p className={styles.bonusLead}>
              Chaque commande fait avancer ton album et peut débloquer des récompenses.
            </p>

            <div className={styles.boosterOffer}>
              <p className={styles.boosterEyebrow}>Booster promo</p>
              <h3>600 € de bons d&apos;achat à gagner</h3>
              <p className={styles.boosterDescription}>
                À chaque commande payée, tu cumules des packs (1 pack pour 5 € TTC).
                Retrouve tes boosters à ouvrir dans Mon Album pour tenter le gros lot et
                décrocher d&apos;autres récompenses : 12 bons d&apos;achat de 50 €, émis à
                raison d&apos;un par mois pendant 12 mois, hors frais de port.
              </p>
            </div>

            <ul className={styles.boosterBenefits} aria-label="Avantages du booster promo">
              <li>1 pack / 5 € TTC</li>
              <li>50 € / mois × 12</li>
              <li>Hors frais de port</li>
              <li>Autres lots à gagner</li>
            </ul>

            <Link href="/reglement-jeu-promo" className={styles.boosterCta}>
              Voir le règlement
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.boosterIllustration}>
            <Image
              src="/mascots/home-booster.png"
              alt="Le personnage des Chanvriers Bretons présente un paquet booster à collectionner"
              width={1448}
              height={1086}
              sizes="(max-width: 767px) 80vw, 48vw"
              className={styles.boosterImage}
            />
          </div>
        </div>
      </section>

      <HomeBadgePromoBand />

      {isSectionVisible(homeSections, "hero") && home.seasonGalleryImages.length > 0 && (
        <HomeSeasonGallery
          title={home.seasonGalleryTitle.trim() || "En direct de nos cultures"}
          images={home.seasonGalleryImages}
          zIndex={1}
          decorativeBackgroundSrc="/legal-circle-bg.png"
          mascotSrc="/sylvain.png"
        />
      )}

      {customSections.map((section) => (
        <CustomSection key={section.id} id={section.id} custom={section.custom} variant="band" />
      ))}

      <section className={styles.seoSection} aria-labelledby="seo-home-title">
        <div className="retro-container">
          <div className={styles.seoCard}>
            <p className={styles.kicker}>De la graine à votre porte</p>
            <h2 id="seo-home-title">CBD naturel direct producteur en Bretagne</h2>
            <div className={styles.seoColumns}>
              <p>{CBD_NATUREL_CANONICAL_ANSWER}</p>
              <p>
                Les Chanvriers Bretons cultivent du chanvre en Bretagne et proposent aussi des références de
                producteurs partenaires français. Chaque fiche distingue le producteur, l&apos;origine déclarée,
                la composition et l&apos;analyse disponible pour le produit concerné.
              </p>
            </div>
            <div className={styles.seoActions}>
              <Link href="/cbd-naturel">Découvrir notre CBD naturel</Link>
              <Link href="/cbd-pas-cher">Comprendre notre prix juste</Link>
              <ContactEmailButton
                label="Parler avec nous"
                buttonClassName={styles.contactLink}
                statusClassName={styles.contactStatus}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
