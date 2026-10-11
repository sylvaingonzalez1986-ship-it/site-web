"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ArrowRight, Camera, Check, Clock3, Globe2, Megaphone, Monitor, Paintbrush, Sparkles, Store, Users } from "lucide-react";
import { isKqCommerceStockMature, type KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_MARKETING_MISSIONS, KQ_ONLINE_SITE_TIERS, KQ_ONLINE_UPGRADES, getKqOnlineUpgradeCost } from "@/lib/kanab-quest-online";
import styles from "./KqOnlineBusiness.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Angle = "value" | "craft" | "premium";
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const angles: Array<{ code: Angle; name: string }> = [{ code: "value", name: "Accessible · le juste prix" }, { code: "craft", name: "Artisan · le savoir-faire" }, { code: "premium", name: "Sélection · la qualité" }];

function ShopIdentity({ name, canCreate, busy, onAsk }: { name: string | null; canCreate: boolean; busy: boolean; onAsk: Ask }) {
  const helpId = useId();
  const [value, setValue] = useState(name ?? "");
  const normalized = value.normalize("NFC").trim().replace(/\s+/g, " ");
  const valid = [...normalized].length >= 3 && [...normalized].length <= 40 && !/[\p{Cc}\p{Cf}<>]/u.test(value);
  return <form className={styles.form} onSubmit={event => {
    event.preventDefault();
    if (!valid || busy || (!name && !canCreate)) return;
    onAsk(name ? "Renommer ta boutique" : "Ouvrir ta boutique de base", name ? `Ta boutique s’appellera « ${normalized} ». Son audience, sa confiance et ses annonces sont conservées.` : `« ${normalized} » ouvre gratuitement, sans abonnement. Les ventes automatiques supportent 2,5 % de frais en plus de la TVA de jeu. Tu prépareras ensuite tes paquets au Marché.`, { action: name ? "rename-shop" : "create-shop", name: normalized }, 0);
  }}>
    <label>Nom de ta boutique<input value={value} onChange={event => setValue(event.target.value)} maxLength={80} placeholder="Ton nom de marque" autoComplete="off" disabled={busy} aria-describedby={helpId} /></label>
    <small id={helpId}>3 à 40 caractères. {value && !valid ? "Ajuste le nom pour continuer." : "Ce nom accompagne tes produits et ta communication."}</small>
    <button className={styles.primary} disabled={busy || !valid || (name ? normalized === name : !canCreate)}>{name ? "Enregistrer le nom" : "Ouvrir gratuitement"}<ArrowRight size={16} aria-hidden="true" /></button>
  </form>;
}

export function KqOnlineBusiness({ data, busy, now, onAsk, onOpenShop }: { data: KqCommerceSnapshot; busy: boolean; now: number; onAsk: Ask; onOpenShop: () => void }) {
  const [missionAngles, setMissionAngles] = useState<Record<string, Angle>>({});
  const [missionStock, setMissionStock] = useState("");
  const online = data.online;
  if (!online || !data.business) return null;
  const shop = data.business.shop;
  const site = online.site;
  const tier = KQ_ONLINE_SITE_TIERS.find(item => item.code === site.tier) ?? KQ_ONLINE_SITE_TIERS[0];
  const currentTierIndex = KQ_ONLINE_SITE_TIERS.findIndex(item => item.code === site.tier);
  const nextTier = KQ_ONLINE_SITE_TIERS[currentTierIndex + 1];
  const nextCost = nextTier ? getKqOnlineUpgradeCost(site.tier, nextTier.code) : 0;
  const progression = nextTier ? Math.round((Math.min(1, online.stats.orders / nextTier.minimumOrders) + Math.min(1, online.confidence / nextTier.minimumConfidence) + Math.min(1, data.cashCents / nextCost)) / 3 * 100) : 100;
  const open = Boolean(shop.createdAt);
  const activeMission = online.marketing.active && Date.parse(online.marketing.active.endsAt) > now ? online.marketing.active : null;
  const activeDefinition = KQ_ONLINE_MARKETING_MISSIONS.find(item => item.code === activeMission?.code);
  const missionStocks = [...new Map([
    ...data.stocks.filter(stock => stock.route !== "biomass" && isKqCommerceStockMature(stock, now)).map(stock => [stock.id, { id: stock.id, name: stock.name }] as const),
    ...online.listings.map(listing => [listing.stockId, { id: listing.stockId, name: listing.name }] as const),
  ]).values()];
  const selectedStockId = missionStocks.some(stock => stock.id === missionStock) ? missionStock : missionStocks[0]?.id ?? "";
  const command = (title: string, description: string, name: string, payload: Record<string, unknown>, cost = 0) => onAsk(title, description, { action: "online", command: name, payload }, cost);
  return <section className={styles.business} aria-label="Développer ma boutique en ligne">
    <header className={styles.heading}><div><span className={styles.eyebrow}><Store size={16} aria-hidden="true" /> Ta marque, pas à pas</span><h2>{shop.name ?? "Ta première boutique"}</h2></div><span className={styles.badge} data-active={site.active}>{open ? site.active ? tier.name : "En pause" : "À créer"}</span></header>
    <p>Les réseaux amènent des visiteurs. Le site les aide à commander. Le bon rapport qualité-prix leur donne envie de revenir.</p>
    <dl className={styles.metrics}><div><dt>Audience</dt><dd>{number(online.followers)}</dd><small>abonnés simulés</small></div><div><dt>Confiance</dt><dd>{number(online.confidence)}<small> / 100</small></dd><small>expérience des clients</small></div><div><dt>Commandes</dt><dd>{number(online.stats.orders)}</dd><small>depuis l’ouverture</small></div></dl>
    {open && nextTier ? <section className={styles.nextChapter} aria-label="Prochaine étape de ta boutique"><span className={styles.chapterNumber}>0{currentTierIndex + 2}</span><div><small>Ton prochain cap</small><h3>{nextTier.name}</h3><ul><li data-complete={online.stats.orders >= nextTier.minimumOrders}>{online.stats.orders >= nextTier.minimumOrders ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{number(Math.min(online.stats.orders, nextTier.minimumOrders))}/{nextTier.minimumOrders} commandes</li><li data-complete={online.confidence >= nextTier.minimumConfidence}>{online.confidence >= nextTier.minimumConfidence ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{number(online.confidence)}/{nextTier.minimumConfidence} confiance</li><li data-complete={data.cashCents >= nextCost}>{data.cashCents >= nextCost ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{formatKqCash(nextCost)} à investir</li></ul><progress max={100} value={progression} aria-label={`Progression vers ${nextTier.name}`} /></div></section> : open ? <div className={styles.nextChapter}><Sparkles size={32} aria-hidden="true" /><div><small>Ta boutique est au meilleur niveau</small><h3>À toi de faire vivre ta marque.</h3><p>La qualité de tes prochaines commandes continue à construire ta clientèle.</p></div></div> : null}
    {!open ? <>
      <div className={styles.notice}><p><strong>Le site de base est gratuit.</strong> Aucun abonnement : 2,5 % de frais sur les ventes. Au départ, les premières commandes se gagnent progressivement ; tes ventes aux shops peuvent financer la culture.</p></div>
      {!data.computerOwned ? <div className={styles.notice}><p><Monitor size={17} aria-hidden="true" /> Un ordinateur est nécessaire pour gérer ta boutique.</p><button className={styles.secondary} disabled={busy} onClick={onOpenShop}>Voir l’ordinateur · 450 €</button></div> : null}
      <ShopIdentity name={null} canCreate={data.computerOwned} busy={busy} onAsk={onAsk} />
    </> : <>
      <div className={styles.funnel}><Users size={18} aria-hidden="true" /><span><strong>Les ventes continuent hors connexion.</strong> Mets des paquets en vente au Marché, puis développe une audience adaptée à tes prix. Chaque commande partage le même budget de demande entre tes annonces.</span></div>
      <details className={styles.rename}><summary>Changer le nom de la boutique</summary><ShopIdentity key={shop.name} name={shop.name} canCreate={false} busy={busy} onAsk={onAsk} /></details>
    </>}

    <section className={styles.section} aria-label="Améliorations du site"><h3><Globe2 size={21} aria-hidden="true" /> Un site à ta mesure</h3><p>Améliorer le site facilite les achats. Il faut toujours des visiteurs, des prix cohérents et du stock. Les frais de vente de 2,5 % s’appliquent à chaque formule.</p>
      <div className={styles.tiers}>{KQ_ONLINE_SITE_TIERS.map((item, index) => {
        const current = item.code === site.tier;
        const previous = index < currentTierIndex;
        const cost = getKqOnlineUpgradeCost(site.tier, item.code);
        const affordable = data.cashCents >= cost;
        const eligible = online.stats.orders >= item.minimumOrders && online.confidence >= item.minimumConfidence;
        return <article className={styles.card} key={item.code} data-current={current}><span className={styles.tierStep}>Étape 0{index + 1}{current ? open ? " · Ton échoppe" : " · Site de départ" : previous ? " · Acquise" : " · À développer"}</span><h4>{item.name}</h4><strong>{current ? open ? "Installée" : "Incluse à l’ouverture" : previous ? "Déjà dépassée" : cost ? formatKqCash(cost) : "Gratuit"}</strong><small>{item.monthlyCents ? `${formatKqCash(item.monthlyCents)} / mois de jeu · tous les 5 jours réels` : "Sans abonnement · 2,5 % sur les ventes"}</small><p>{item.description}</p>{item.code !== "basic" ? <small>Conversion × {number(item.conversionMultiplier)} · {item.minimumOrders} commandes et {item.minimumConfidence}/100 de confiance requis. Premier mois inclus à l’amélioration.</small> : null}
          {current ? <span className={styles.owned}>{open ? <Check size={16} aria-hidden="true" /> : <Store size={16} aria-hidden="true" />}{open ? "Version actuelle" : "Site de départ"}</span> : <button className={styles.secondary} disabled={busy || !open || previous || !affordable || !eligible} onClick={() => command(`Passer à la ${item.name.toLocaleLowerCase("fr-FR")}`, `${formatKqCash(cost)} pour cette amélioration, premier mois inclus. Puis ${formatKqCash(item.monthlyCents)} tous les 30 jours de jeu (5 jours réels). Le site améliore la conversion sans garantir des commandes.`, "upgrade-site", { tier: item.code }, cost)}>{!open ? "Ouvre d’abord ta boutique" : previous ? "Version précédente" : !eligible ? "Développe d’abord ta clientèle" : !affordable ? "Trésorerie insuffisante" : "Améliorer le site"}</button>}
        </article>;
      })}</div>
      {open && tier.monthlyCents > 0 ? <div className={styles.renewal}><span><strong>{site.active ? "Hébergement de ta boutique" : "Hébergement suspendu"}</strong><small>{site.paidUntil ? `${site.renew ? "Renouvellement" : "Période payée jusqu’au"} : ${date(site.paidUntil)}` : "Aucune période payée"}</small><small>{formatKqCash(tier.monthlyCents)} tous les 5 jours réels.</small></span>{!site.active ? <button className={styles.primary} disabled={busy || data.cashCents < tier.monthlyCents} onClick={() => onAsk("Réactiver la boutique", `${formatKqCash(tier.monthlyCents)} pour 30 jours de jeu, soit 5 jours réels. Les paquets encore en vente pourront retrouver leurs clients.`, { action: "renew-shop" }, tier.monthlyCents)}>Réactiver · {formatKqCash(tier.monthlyCents)}</button> : <button className={styles.secondary} disabled={busy} onClick={() => onAsk(site.renew ? "Désactiver la reconduction" : "Activer la reconduction", site.renew ? "La période déjà payée est conservée. Aucun renouvellement ne sera facturé à son terme." : `${formatKqCash(tier.monthlyCents)} seront prélevés à chaque échéance si les fonds suffisent.`, { action: "shop-renewal", enabled: !site.renew }, 0)}>{site.renew ? "Arrêter la reconduction" : "Activer la reconduction"}</button>}</div> : null}
    </section>

    <section className={styles.section} aria-label="Identité et présentation"><h3><Paintbrush size={21} aria-hidden="true" /> Fais bonne impression</h3><p>Des investissements permanents pour présenter ce que tu produis. Ils n’ajoutent aucun point à la qualité de tes lots.</p><div className={styles.upgrades}>{KQ_ONLINE_UPGRADES.map(upgrade => {
      const owned = online.upgrades[upgrade.code];
      const Icon = upgrade.code === "photography" ? Camera : Paintbrush;
      return <article key={upgrade.code} className={`${styles.card} ${styles.contract}`} data-current={owned}><span className={styles.contractLabel}><Icon size={22} aria-hidden="true" />{upgrade.code === "photography" ? "Le coin photo" : "L’atelier du graphiste"}</span><h4>{upgrade.name}</h4><strong>{formatKqCash(upgrade.costCents)}</strong><p>{upgrade.description}</p>{owned ? <span className={styles.owned}><Check size={16} aria-hidden="true" /> Déjà installé</span> : <button className={styles.secondary} disabled={busy || !open || data.cashCents < upgrade.costCents} onClick={() => command(upgrade.name, `${upgrade.description} Achat permanent de ${formatKqCash(upgrade.costCents)}.`, "buy-upgrade", { code: upgrade.code }, upgrade.costCents)}>{!open ? "Ouvre d’abord ta boutique" : data.cashCents < upgrade.costCents ? "Trésorerie insuffisante" : "Investir"}</button>}</article>;
    })}</div></section>

    <section className={styles.section} aria-label="Réseaux sociaux simulés"><div className={styles.missionScene}><Image src="/placard/market-social-missions-v2.webp" alt="" fill sizes="(max-width: 700px) 100vw, 1050px" /><div><small><Megaphone size={15} aria-hidden="true" />Le relais de ta marque</small><h3>Fais découvrir ton histoire.</h3><p>Choisis une mission et un public sur les réseaux du jeu. Aucune publication réelle. Les résultats continuent hors connexion.</p></div></div><p>Une mission à la fois. L’angle choisi attire des visiteurs plus ou moins intéressés par tes produits et tes prix.</p>
      {activeMission ? <div className={styles.activeMission}><strong><Sparkles size={18} aria-hidden="true" /> {activeDefinition?.name ?? "Mission en cours"}</strong><p>Angle : {angles.find(item => item.code === activeMission.angle)?.name ?? "Artisan"}. Fin le {date(activeMission.endsAt)}.</p><progress max={100} value={Math.max(0, Math.min(100, (now - Date.parse(activeMission.startedAt)) / (Date.parse(activeMission.endsAt) - Date.parse(activeMission.startedAt)) * 100))} aria-label="Avancement de la mission en cours" /></div> : null}
      <div className={styles.missions}>{KQ_ONLINE_MARKETING_MISSIONS.map((mission, index) => {
        const completed = mission.code === "introduction" && online.marketing.completedCodes.includes(mission.code);
        const cooldown = online.marketing.cooldowns[mission.code];
        const waiting = Boolean(cooldown && Date.parse(cooldown) > now);
        const angle = missionAngles[mission.code] ?? "craft";
        const requiresStock = Boolean(mission.requiresStock);
        const requiredOrders = mission.minimumOrders ?? 0;
        const enoughOrders = online.stats.orders >= requiredOrders;
        const disabled = busy || !site.active || Boolean(activeMission) || completed || waiting || !enoughOrders || (requiresStock && !selectedStockId);
        return <article key={mission.code} className={styles.mission} data-complete={completed} data-active={activeMission?.code === mission.code}><div className={styles.missionTop}><span>Mission 0{index + 1}</span><small><Clock3 size={13} aria-hidden="true" />{mission.durationHours} h réelles</small></div><h4>{mission.name}</h4><p>{mission.description}</p><strong>Environ +{mission.visitorsPerDay} visiteurs / jour réel</strong><small>+{mission.followersReward} abonnés à la fin · les visites dépendent aussi de ton angle</small>
          <label>Ton angle<select disabled={disabled} value={angle} onChange={event => setMissionAngles(value => ({ ...value, [mission.code]: event.target.value as Angle }))}>{angles.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          {requiresStock ? <label>Le lot à présenter<select disabled={disabled} value={selectedStockId} onChange={event => setMissionStock(event.target.value)}><option value="" disabled>Aucun lot mûr disponible</option>{missionStocks.map(stock => <option key={stock.id} value={stock.id}>{stock.name}</option>)}</select><small>Une présentation par récolte, y compris si elle est déjà conditionnée.</small></label> : null}
          {waiting ? <small>Disponible le {date(cooldown)}</small> : !enoughOrders ? <small>Encore {requiredOrders - online.stats.orders} commande{requiredOrders - online.stats.orders > 1 ? "s" : ""} pour recueillir des retours.</small> : null}
          <button className={styles.secondary} disabled={disabled} onClick={() => command(`Lancer « ${mission.name} »`, `${angles.find(item => item.code === angle)?.name} : ${mission.visitorsPerDay} visites supplémentaires par jour réel pendant ${mission.durationHours} h. Les visiteurs restent libres d’acheter selon tes prix, la qualité et la confiance.`, "start-marketing", { code: mission.code, angle, ...(requiresStock ? { stockId: selectedStockId } : {}) })}>{completed ? "Mission accomplie" : activeMission ? "Une mission est en cours" : !site.active ? "Boutique ouverte requise" : waiting ? "Laisse ton audience respirer" : !enoughOrders ? "Premières commandes requises" : "Lancer la mission gratuite"}</button>
        </article>;
      })}</div>
    </section>
  </section>;
}
