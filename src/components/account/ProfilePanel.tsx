"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { ArrowDown, ArrowUpRight, Award, BookOpen, ChevronDown, Copy, Download, Gift, LogOut, ShoppingBag, Star, Swords, Tag, User as UserIcon, Users, type LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { LoyaltyBadgeSummary } from "@/components/account/LoyaltyBadgeSummary";
import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import { MissionsSection } from "@/components/account/MissionsSection";
import { OrderDetailModal } from "@/components/account/OrderDetailModal";
import { useCmsStore } from "@/hooks/useCmsStore";
import { useCustomerSession } from "@/hooks/useCustomerSession";
import {
  getBadgeBenefitsText,
  getBadgeDiscountPercent,
  getBadgeTierHomeDeliveryBenefitLabel,
  getBadgeTierRelayBenefitLabel,
  parseBadgeBenefitsLines,
} from "@/lib/loyalty-tier-benefits";
import { formatPrice } from "@/lib/utils";
import type { PublicCustomer } from "@/types/customer";
import type { ReferralSummary } from "@/types/referral";
import type { CmsOrder, OrderStatus } from "@/types/store";
import styles from "./ProfilePanel.module.css";

const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Nouvelle",
  pending_payment: "Paiement en attente",
  paid: "Payée",
  processing: "En préparation",
  shipped: "Expédiée",
  cancelled: "Annulée",
};

const paymentStateLabels: Record<CmsOrder["paymentState"], string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échec",
  not_configured: "Validation manuelle",
};

function getOrderStatusColorClass(status: OrderStatus): string {
  switch (status) {
    case "pending_payment":
      return "bg-[#ffe8e8] text-[#7a1010]";
    case "paid":
    case "processing":
      return "bg-[#fff1db] text-[#7c4a00]";
    case "shipped":
      return "bg-[#e8f7f2] text-[#0f5b3f]";
    case "cancelled":
      return "bg-[#ffe8e8] text-[#7a1010]";
    default:
      return "bg-[#f7f4ee] text-ink";
  }
}

function getPaymentStateColorClass(paymentState: CmsOrder["paymentState"]): string {
  switch (paymentState) {
    case "pending":
      return "bg-[#ffe8e8] text-[#7a1010]";
    case "paid":
      return "bg-[#fff1db] text-[#7c4a00]";
    case "failed":
      return "bg-[#ffe8e8] text-[#7a1010]";
    default:
      return "bg-[#f7f4ee] text-ink";
  }
}

type ProfileTab = "fidelite" | "missions" | "commandes" | "infos" | "promos";

type ProfileTabDefinition = {
  key: ProfileTab;
  label: string;
  description: string;
  icon: LucideIcon;
};

const profileTabs: ProfileTabDefinition[] = [
  { key: "fidelite", label: "Progression", description: "Chaque point te rapproche du prochain palier.", icon: Award },
  { key: "missions", label: "Quêtes", description: "De petites missions, de nouvelles récompenses.", icon: Star },
  { key: "commandes", label: "Commandes", description: "Retrouve tes achats et suis leur préparation.", icon: ShoppingBag },
  { key: "infos", label: "Mes infos", description: "Tes coordonnées, toujours à jour pour la prochaine commande.", icon: UserIcon },
  { key: "promos", label: "Mes offres", description: "Tes codes et tes petits coups de pouce pour la boutique.", icon: Tag },
];

function parseProfileTab(value: string | null): ProfileTab | null {
  if (!value) {
    return null;
  }

  if (
    value === "fidelite" ||
    value === "missions" ||
    value === "commandes" ||
    value === "infos" ||
    value === "promos"
  ) {
    return value;
  }

  return null;
}

function formatNotificationBadge(value: number): string {
  if (value > 99) {
    return "99+";
  }

  return String(value);
}

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "U";
}

export function ProfilePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    orders,
    loyalty,
    loading,
    refresh,
    setUser,
  } = useCustomerSession();
  const { store: cmsStore } = useCmsStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("France");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [deleteConfirmationEmail, setDeleteConfirmationEmail] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CmsOrder | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("fidelite");
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [referralStatus, setReferralStatus] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const activePanelRef = useRef<HTMLDivElement | null>(null);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [orders],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = parseProfileTab(params.get("tab"));
      if (requestedTab) {
        setActiveTab((current) => (current === requestedTab ? current : requestedTab));
        return;
      }

      if (params.has("tab")) {
        params.delete("tab");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }
    };

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);

    return () => {
      window.removeEventListener("popstate", syncTabFromUrl);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFirstName(user.firstName);
    setLastName(user.lastName);
    setDateOfBirth(user.dateOfBirth ?? "");
    setPhone(user.phone);
    setAddress(user.address);
    setCity(user.city);
    setPostalCode(user.postalCode);
    setCountry(user.country || "France");
  }, [user]);

  useEffect(() => {
    if (!user) {
      setReferralSummary(null);
      setReferralCodeInput("");
      return;
    }

    let active = true;
    setReferralLoading(true);

    const loadReferral = async () => {
      try {
        const response = await fetch("/api/account/referral", { cache: "no-store" });
        if (!active) {
          return;
        }

        if (!response.ok) {
          setReferralSummary(null);
          return;
        }

        const data = (await response.json()) as { summary?: ReferralSummary };
        const summary = data.summary ?? null;
        setReferralSummary(summary);
        if (!summary?.referredByCode) {
          setReferralCodeInput("");
        }
      } finally {
        if (active) {
          setReferralLoading(false);
        }
      }
    };

    void loadReferral();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (activeTab !== "missions") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const panel = activePanelRef.current;
      if (!panel) {
        return;
      }

      const navbar = document.querySelector<HTMLElement>("header[data-tutorial='navbar']");
      const navbarOffset = navbar ? navbar.getBoundingClientRect().height + 12 : 24;
      const top = panel.getBoundingClientRect().top + window.scrollY - navbarOffset;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab]);

  if (loading) {
    return (
      <section className={styles.page}>
        <div className={styles.stateShell}>
          <div className={styles.stateCard} role="status"><p className={styles.eyebrow}>Ton espace personnel</p>Chargement de ton profil…</div>
        </div>
      </section>
    );
  }

  if (!user) {
    const nextUrl = "/profil?tab=fidelite";
    const loginHref = `/compte/connexion?next=${encodeURIComponent(nextUrl)}`;

    return (
      <section className={styles.page}>
        <div className={styles.stateShell}>
          <article className={styles.stateCard}>
            <p className={styles.eyebrow}>Ton espace personnel</p>
            <h1>Mon <span>profil.</span></h1>
            <p>
              Connecte-toi pour retrouver ta progression, tes quêtes, tes commandes et tes récompenses.
            </p>
            <div className={styles.stateActions}>
              <Link
                href="/fidelite"
                className={styles.secondaryAction}
              >
                Découvrir la progression
              </Link>
              <Link
                href={loginHref}
                className={styles.primaryAction}
              >
                Se connecter
              </Link>
            </div>
          </article>
          <div className={styles.publicSummary}>
            <LoyaltyBadgeSummary />
          </div>
        </div>
      </section>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setSaving(true);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth,
          phone,
          address,
          city,
          postalCode,
          country,
        }),
      });

      if (!response.ok) {
        setStatus("Erreur mise à jour profil.");
        return;
      }

      setStatus("Profil mis à jour.");
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const applyReferralCode = async () => {
    const normalizedCode = referralCodeInput.trim().toUpperCase();
    if (!normalizedCode) {
      setReferralError("Saisis un code parrain.");
      setReferralStatus(null);
      return;
    }

    setReferralLoading(true);
    setReferralError(null);
    setReferralStatus(null);

    try {
      const response = await fetch("/api/account/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const data = (await response.json()) as {
        error?: string;
        summary?: ReferralSummary;
        user?: PublicCustomer | null;
      };

      if (!response.ok) {
        setReferralError(data.error || "Impossible d'appliquer ce code parrain.");
        return;
      }

      if (data.summary) {
        setReferralSummary(data.summary);
      }
      if (data.user) {
        setUser(data.user);
      }
      setReferralCodeInput("");
      setReferralStatus("Code parrain appliqué.");
      await refresh({ silent: true });
    } finally {
      setReferralLoading(false);
    }
  };

  const copyReferralLink = async () => {
    if (!user.referralCode || typeof window === "undefined") {
      return;
    }

    const shareUrl = `${window.location.origin}/compte/inscription?ref=${encodeURIComponent(user.referralCode)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("Lien de parrainage copie.");
    } catch {
      setCopyStatus("Copie impossible sur cet appareil.");
    }
  };

  const logout = async () => {
    await fetch("/api/account/logout", { method: "POST" });
    router.replace("/");
  };

  const downloadPersonalData = async () => {
    setExportStatus(null);
    setExportingData(true);

    try {
      const response = await fetch("/api/account/export", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setExportStatus(payload?.error || "Impossible de generer l'export pour le moment.");
        return;
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const filename = response.headers
        .get("content-disposition")
        ?.match(/filename="?([^";]+)"?/)?.[1] || "mes-donnees.json";

      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      setExportStatus("Export genere. Le telechargement a demarre.");
    } finally {
      setExportingData(false);
    }
  };

  const requestAccountDeletion = async () => {
    setDeleteStatus(null);
    setDeletingAccount(true);

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: deleteConfirmationEmail }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;

      if (!response.ok) {
        setDeleteStatus(payload?.error || "Suppression impossible pour le moment.");
        return;
      }

      router.replace("/?accountDeleted=true");
      router.refresh();
    } finally {
      setDeletingAccount(false);
    }
  };

  const setActiveTabAndSync = (tab: ProfileTab) => {
    if (tab === "missions" && activeTab === "missions") {
      const panel = activePanelRef.current;
      if (panel && typeof window !== "undefined") {
        const navbar = document.querySelector<HTMLElement>("header[data-tutorial='navbar']");
        const navbarOffset = navbar ? navbar.getBoundingClientRect().height + 12 : 24;
        const top = panel.getBoundingClientRect().top + window.scrollY - navbarOffset;
        window.scrollTo({
          top: Math.max(0, top),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
      }
      return;
    }

    setActiveTab(tab);

    const nextParams =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    nextParams.set("tab", tab);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const getTabNotification = (tab: ProfileTab): string | null => {
    if (tab === "infos" && !user.dateOfBirth) {
      return "!";
    }

    if (tab === "promos") {
      const activePromos = user.promoCodes.filter((promo) => !promo.used).length;
      if (activePromos > 0) {
        return formatNotificationBadge(activePromos);
      }
    }

    return null;
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString("fr-FR");
  const profileContent = cmsStore.content.profile;
  const popupTitle = profileContent.badgeBenefitsModalTitle.trim() || "Avantages du palier";
  const popupHint =
    profileContent.badgeBenefitsModalHint.trim() || "Chaque ligne correspond a un avantage.";
  const activeTabDefinition = profileTabs.find((tab) => tab.key === activeTab) ?? profileTabs[0];
  const ActiveTabIcon = activeTabDefinition.icon;

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Le club des bons vivants</p>
          <h1 className={styles.heroTitle}>Ton coin.<br /><span>Ta progression.</span></h1>
          <p className={styles.heroLead}>Salut {user.firstName || "à toi"} ! Tes points, tes trouvailles et la suite de l’aventure, c’est ici.</p>
          <div className={styles.heroActions}>
            <Link href="/arene" className={styles.secondaryAction}><Swords size={18} /> Rejoindre l’arène <ArrowUpRight size={17} /></Link>
            <Link href="/profil/collection" className={styles.heroLink}><BookOpen size={18} /> Mon album <ArrowUpRight size={16} /></Link>
          </div>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <Image src="/contest/mascot/profile-sylvain-member-v2.png" alt="" width={1254} height={1254} sizes="(max-width: 680px) 110px, (max-width: 960px) 220px, 290px" preload />
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.overview} aria-label="Tes points fidélité">
          <div><span>Points cumulés</span><strong>{loyalty.points}<small> pts</small></strong></div>
          <div><span>Points disponibles</span><strong>{loyalty.spendablePoints}<small> pts</small></strong></div>
          <div><span>Commandes éligibles</span><strong>{loyalty.eligibleOrdersCount}</strong></div>
          <div><span>Achats comptabilisés</span><strong>{formatPrice(loyalty.totalEligibleSpend)}</strong></div>
        </div>
        <div className={styles.sectionLabel}><span>Ton espace personnel</span><span>À toi de jouer <ArrowDown size={13} /></span></div>
        <div className={styles.tabs} role="tablist" aria-label="Sections du profil">
          {profileTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            const notification = getTabNotification(tab.key);

            return (
              <button
                key={tab.key}
                id={`profile-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={isActive ? `profile-tabpanel-${tab.key}` : undefined}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(event) => {
                  const index = profileTabs.findIndex((item) => item.key === tab.key);
                  const nextIndex = event.key === "ArrowRight" ? (index + 1) % profileTabs.length
                    : event.key === "ArrowLeft" ? (index + profileTabs.length - 1) % profileTabs.length
                    : event.key === "Home" ? 0 : event.key === "End" ? profileTabs.length - 1 : null;
                  if (nextIndex === null) return;
                  event.preventDefault();
                  const nextTab = profileTabs[nextIndex].key;
                  setActiveTabAndSync(nextTab);
                  document.getElementById(`profile-tab-${nextTab}`)?.focus({ preventScroll: true });
                }}
                onClick={() => setActiveTabAndSync(tab.key)}
                data-tutorial={tab.key === "missions" ? "profile-missions-shortcut" : undefined}
              >
                <Icon aria-hidden="true" />
                <span className={tab.key === "fidelite" ? styles.tabLabelLong : undefined}>{tab.label}</span>
                {tab.key === "fidelite" && <span className={styles.tabLabelShort} aria-hidden="true">Progrès</span>}
                {notification ? <strong>{notification}</strong> : null}
              </button>
            );
          })}
        </div>

        <div className={styles.profileGrid}>
          <aside className={styles.summaryPanel} aria-label="Résumé du profil">
            <div className={styles.memberCard}>
              <div className={styles.memberTop}><span>Carte de membre</span><Star size={16} aria-hidden="true" /></div>
              <div className={styles.memberIdentity}>
                <span className={styles.avatar}>{getInitials(user.firstName, user.lastName)}</span>
                <div><h2>{user.firstName} {user.lastName}</h2><p>Depuis le {memberSince}</p></div>
              </div>
              <p className={styles.memberEmail}>{user.email}</p>
              <div className={styles.memberBadge}>
                <LoyaltyBadgeIllustration badgeId={loyalty.currentBadge.id} unlocked={loyalty.currentBadge.unlocked} size="sm" />
                <div><small>{loyalty.currentBadge.unlocked ? "Ton palier" : "Premier objectif"}</small><strong>{loyalty.currentBadge.label}</strong></div>
              </div>
              <button type="button" className={styles.memberEdit} onClick={() => setActiveTabAndSync("infos")}>Modifier mes infos <ArrowUpRight size={16} /></button>
            </div>
            <Link href="/arene" className={styles.arenaCard}>
              <Swords size={22} aria-hidden="true" /><div><strong>L’aventure continue</strong><p>Un tour dans l’arène ?</p></div><ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <button type="button" onClick={logout} className={styles.logout}><LogOut size={16} /> Se déconnecter</button>
          </aside>

          <div
            ref={activePanelRef}
            id={`profile-tabpanel-${activeTab}`}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`profile-tab-${activeTab}`}
            className={styles.activePanel}
          >
            <div className={styles.panelHeading}>
              <span><ActiveTabIcon aria-hidden="true" /></span>
              <div>
                <h2>{activeTabDefinition.label}</h2>
                <p>{activeTabDefinition.description}</p>
              </div>
            </div>

          {activeTab === "fidelite" && (
            <>
              <div className={styles.progressCard}>
                <p className={styles.eyebrow}>{loyalty.currentBadge.unlocked ? "Ton palier actuel" : "L’aventure commence"}</p>
                <div className="mt-3 flex items-center gap-3">
                  <LoyaltyBadgeIllustration
                    badgeId={loyalty.currentBadge.id}
                    unlocked={loyalty.currentBadge.unlocked}
                    size="md"
                  />
                  <div>
                    <h2 className="font-display text-3xl text-ink">{loyalty.currentBadge.label}</h2>
                    <p className="text-sm text-charcoal">{loyalty.currentBadge.description}</p>
                    <p className="mt-1 text-xs font-semibold text-ink">
                      {(() => {
                        if (loyalty.currentBadge.unlocked) {
                          return `${getBadgeTierRelayBenefitLabel(loyalty.currentBadge.id)} / ${getBadgeTierHomeDeliveryBenefitLabel(loyalty.currentBadge.id)}`;
                        }

                        return "Débloque ce badge pour activer l'avantage livraison";
                      })()}
                    </p>
                    {!loyalty.currentBadge.unlocked && (
                      <p className="mt-1 text-xs font-semibold text-charcoal">À débloquer</p>
                    )}
                  </div>
                </div>

                {loyalty.nextBadge ? (
                  <div className="mt-6">
                    <p className="text-sm text-charcoal">
                      Encore <span className="font-semibold text-ink">{loyalty.pointsToNextBadge} points</span> pour atteindre{" "}
                      <span className="font-semibold text-ink">{loyalty.nextBadge.label}</span>.
                    </p>
                    <div className={styles.progressTrack} role="progressbar" aria-label="Progression vers le prochain palier" aria-valuetext={`${loyalty.pointsToNextBadge} points restants pour atteindre ${loyalty.nextBadge.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={loyalty.progressToNextBadge}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${loyalty.progressToNextBadge}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 text-sm font-semibold text-ink">Niveau maximal atteint.</p>
                )}
              </div>

              <section className={styles.badgeSection} aria-labelledby="loyalty-badges-title">
                <div className={styles.badgeSectionHeading}>
                  <h3 id="loyalty-badges-title">Les paliers du club</h3><span>1 € dépensé = 1 point</span>
                </div>
                <p className={styles.sectionHint}>Ouvre un palier pour découvrir tous ses avantages.</p>
                <div className={styles.badgeList}>
                  {loyalty.badges.map((badge) => (
                    <details key={badge.id} className={styles.badgeDetails} data-unlocked={badge.unlocked}>
                      <summary>
                        <LoyaltyBadgeIllustration badgeId={badge.id} unlocked={badge.unlocked} size="sm" />
                        <span className={styles.badgeName}><strong>{badge.label}</strong><small>{badge.minPoints.toLocaleString("fr-FR")} points</small></span>
                        <span className={styles.badgeState}>{badge.unlocked ? "Débloqué" : "À débloquer"}</span>
                        <ChevronDown size={18} className={styles.badgeChevron} aria-hidden="true" />
                      </summary>
                      <div className={styles.badgeBenefits}>
                        <h4>{popupTitle}</h4>
                        <p>{badge.description}</p>
                        <p><strong>Réduction permanente : {getBadgeDiscountPercent(profileContent, badge.id)} %</strong></p>
                        <p>Livraison : {getBadgeTierRelayBenefitLabel(badge.id)} / {getBadgeTierHomeDeliveryBenefitLabel(badge.id)}</p>
                        {parseBadgeBenefitsLines(getBadgeBenefitsText(profileContent, badge.id)).length > 0 && <>
                          <p className={styles.sectionHint}>{popupHint}</p>
                          <ul>{parseBadgeBenefitsLines(getBadgeBenefitsText(profileContent, badge.id)).map((benefit, index) => <li key={index}>{benefit}</li>)}</ul>
                        </>}
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              <div className={styles.referralCard} data-tutorial="profile-referral">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Parrainage</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      Invite tes proches et gagne des points bonus.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary inline-flex h-10 items-center justify-center gap-2 px-3 text-xs leading-none"
                    onClick={copyReferralLink}
                    disabled={!user.referralCode}
                  >
                    <Copy size={14} className="shrink-0" /> Copier mon lien
                  </button>
                </div>

                {copyStatus && <p role="status" className="mt-2 text-xs font-semibold text-ink">{copyStatus}</p>}
                <details className={styles.referralDetails}>
                  <summary>Mon code, mes bonus et mon parrain <ChevronDown size={16} aria-hidden="true" /></summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Mon code</p>
                    <p className="mt-1 font-mono text-lg font-bold text-ink">
                      {referralSummary?.referralCode || user.referralCode || "-"}
                    </p>
                  </div>
                  <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Mon statut filleul</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {referralSummary?.referredByCode
                        ? `Code utilisé : ${referralSummary.referredByCode}`
                        : "Aucun code parrain utilisé"}
                    </p>
                  </div>
                </div>

                {referralSummary && (
                  <div className={styles.referralStats}>
                    <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Filleuls</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-ink">
                        <Users size={16} /> {referralSummary.totalReferrals}
                      </p>
                    </div>
                    <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Récompenses</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-ink">
                        <Gift size={16} /> {referralSummary.rewardedReferrals}
                      </p>
                    </div>
                    <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Points parrains</p>
                      <p className="mt-1 text-lg font-bold text-ink">{referralSummary.pointsEarnedAsReferrer}</p>
                    </div>
                    <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Points filleul</p>
                      <p className="mt-1 text-lg font-bold text-ink">{referralSummary.pointsEarnedAsReferee}</p>
                    </div>
                  </div>
                )}

                <p className="mt-3 text-xs text-charcoal">
                  Bonus par parrainage validé : {referralSummary?.config.referrerPoints ?? 0} pts
                  pour le parrain et {referralSummary?.config.refereePoints ?? 0} pts pour le filleul
                  après la première commande payée du filleul.
                </p>
                <p className="mt-1 text-xs text-charcoal">
                  Le filleul obtient aussi 10% de remise automatique sur sa première commande.
                </p>

                {!referralSummary?.referredByCode && (
                  <div className={styles.referralForm}>
                    <input
                      type="text"
                      className="h-11 border-2 border-[#1a1a1a] bg-white px-3 text-sm uppercase"
                      placeholder="J’ai un code parrain"
                      aria-label="Code de parrainage"
                      value={referralCodeInput}
                      onChange={(event) => setReferralCodeInput(event.target.value.toUpperCase())}
                      disabled={referralLoading}
                    />
                    <button
                      type="button"
                      className="btn-cartoon btn-primary inline-flex h-11 items-center justify-center px-4 text-xs leading-none"
                      onClick={applyReferralCode}
                      disabled={referralLoading}
                    >
                      {referralLoading ? "..." : "Appliquer"}
                    </button>
                  </div>
                )}

                {referralLoading && (
                  <p className="mt-2 text-xs font-semibold text-charcoal">Mise à jour du parrainage…</p>
                )}
                {referralStatus && <p role="status" className="mt-2 text-xs font-semibold text-green-700">{referralStatus}</p>}
                {referralError && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{referralError}</p>}
                </details>
              </div>
            </>
          )}

          {activeTab === "missions" && <MissionsSection />}

          {activeTab === "commandes" && (
            <>
              <h2 className="font-display text-3xl">Mes commandes ({sortedOrders.length})</h2>
              {sortedOrders.length === 0 && (
                <div className={styles.emptyState}><ShoppingBag size={32} aria-hidden="true" /><h3>Ta première trouvaille t’attend.</h3><p>Tes commandes et leur suivi apparaîtront ici.</p><Link href="/boutique" className={styles.primaryAction}>Explorer la boutique <ArrowUpRight size={16} /></Link></div>
              )}

              <div className="mt-4 grid gap-4">
                {sortedOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="card-cartoon w-full bg-white p-4 text-left transition-colors hover:bg-[#f7f4ee]"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">{order.id}</p>
                      <p className="text-sm text-charcoal">
                        {new Date(order.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
                      <span className={`pill-cartoon px-3 py-1 ${getOrderStatusColorClass(order.status)}`}>
                        {orderStatusLabels[order.status]}
                      </span>
                      <span className={`pill-cartoon px-3 py-1 ${getPaymentStateColorClass(order.paymentState)}`}>
                        Paiement: {paymentStateLabels[order.paymentState]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      Total: {formatPrice(order.totalAmount)}
                    </p>
                    <div className="mt-2 grid gap-1 text-sm text-charcoal">
                      {order.items.map((item, idx) => (
                        <p key={`${order.id}-${idx}`}>
                          {item.quantity} x {item.name} - {formatPrice(item.lineTotal)}
                        </p>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === "infos" && (
            <>
              <p className={styles.sectionHint}>Renseigne tes informations personnelles et ton adresse de livraison.</p>
              {!user.dateOfBirth && (
                <div
                  className="mt-4 border-2 border-red-700 bg-red-50 p-4 text-sm text-red-900"
                  role="alert"
                >
                  <p className="font-bold">Action requise pour commander</p>
                  <p className="mt-1">
                    Renseignez votre date de naissance ci-dessous. Elle est obligatoire pour
                    confirmer que vous avez 18 ans ou plus et débloquer la commande.
                  </p>
                </div>
              )}
              <form onSubmit={onSubmit} className={styles.infoForm}>
                <label className={styles.field}>
                  <span>Prénom</span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Nom</span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </label>
                <label className={`${styles.field} ${styles.fullField}`}>
                  <span>E-mail</span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-[#f4f4f4] px-3 text-base"
                    value={user.email}
                    readOnly
                    autoComplete="email"
                  />
                </label>
                <label className={`${styles.field} ${styles.fullField}`}>
                  <span className="text-sm font-bold text-ink">
                    Date de naissance <span className="text-red-700">(obligatoire pour commander)</span>
                  </span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    aria-describedby="profile-date-of-birth-help"
                    required
                  />
                  <span
                    id="profile-date-of-birth-help"
                    className="text-xs font-semibold text-charcoal"
                  >
                    Réservé aux personnes majeures (18 ans et plus).
                  </span>
                </label>
                <label className={styles.field}>
                  <span>Téléphone</span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    autoComplete="tel"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </label>
                <label className={`${styles.field} ${styles.fullField}`}>
                  <span>Adresse</span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    autoComplete="street-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Ville</span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Code postal</span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    autoComplete="postal-code"
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                  />
                </label>
                <label className={`${styles.field} ${styles.fullField}`}>
                  <span>Pays</span>
                  <input
                    className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    autoComplete="country-name"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-cartoon btn-primary inline-flex h-12 items-center justify-center leading-none md:col-span-2"
                >
                  {saving ? "Sauvegarde..." : "Enregistrer mes informations"}
                </button>
              </form>

              {status && <p className="mt-3 text-sm font-semibold text-green-700">{status}</p>}
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <article className="card-cartoon bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-[#fff7e4] text-ink">
                      <Download className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-ink">Exporter mes données</h3>
                      <p className="mt-1 text-sm leading-relaxed text-charcoal">
                        Télécharge une copie de tes données personnelles.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadPersonalData}
                    disabled={exportingData}
                    className="btn-cartoon btn-secondary mt-4 inline-flex h-11 items-center justify-center px-4 text-xs leading-none"
                  >
                    {exportingData ? "Préparation…" : "Télécharger mes données"}
                  </button>
                  {exportStatus && (
                    <p className="mt-3 text-sm font-semibold text-ink">{exportStatus}</p>
                  )}
                </article>

                <article className="card-cartoon bg-[#fff7e4] p-5">
                  <h3 className="text-lg font-bold text-ink">Vie privée</h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal">
                    Consulte la politique de confidentialité et la politique cookies pour comprendre
                    les traitements appliqués à tes données.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/politique-confidentialite" className="btn-cartoon btn-secondary inline-flex h-11 items-center justify-center px-4 text-xs leading-none">
                      Politique de confidentialité
                    </Link>
                    <Link href="/politique-cookies" className="btn-cartoon btn-secondary inline-flex h-11 items-center justify-center px-4 text-xs leading-none">
                      Politique cookies
                    </Link>
                  </div>
                </article>
              </div>

              <article className="card-cartoon mt-6 border-[3px] border-[#7a1010] bg-[#fff1f1] p-5">
                <h3 className="text-lg font-bold text-[#7a1010]">Zone sensible</h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal">
                  La suppression du compte est irréversible. Les commandes sont conservées pour les
                  obligations comptables, mais les données personnelles associées sont anonymisées.
                </p>
                {!showDeleteConfirmation ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStatus(null);
                      setShowDeleteConfirmation(true);
                    }}
                    className="btn-cartoon mt-4 inline-flex h-11 items-center justify-center bg-[#7a1010] px-4 text-xs leading-none text-white"
                  >
                    Supprimer mon compte
                  </button>
                ) : (
                  <div className="mt-4 grid gap-3">
                    <p className="text-sm font-semibold text-ink">
                      Saisis ton e-mail pour confirmer : {user.email}
                    </p>
                    <input
                      className="h-12 border-2 border-[#7a1010] bg-white px-3 text-base"
                      placeholder="Confirme ton e-mail"
                      aria-label="E-mail de confirmation de suppression"
                      value={deleteConfirmationEmail}
                      onChange={(event) => setDeleteConfirmationEmail(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={requestAccountDeletion}
                        disabled={deletingAccount}
                        className="btn-cartoon inline-flex h-11 items-center justify-center bg-[#7a1010] px-4 text-xs leading-none text-white disabled:opacity-60"
                      >
                        {deletingAccount ? "Suppression..." : "Confirmer la suppression"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirmation(false);
                          setDeleteConfirmationEmail("");
                          setDeleteStatus(null);
                        }}
                        className="btn-cartoon btn-secondary inline-flex h-11 items-center justify-center px-4 text-xs leading-none"
                      >
                        Annuler
                      </button>
                    </div>
                    {deleteStatus && (
                      <p className="text-sm font-semibold text-[#7a1010]">{deleteStatus}</p>
                    )}
                  </div>
                )}
              </article>
            </>
          )}

          {activeTab === "promos" && (
            <>

              {user.promoCodes.length === 0 ? (
                <div className={styles.emptyState}><Tag size={32} aria-hidden="true" /><h3>Les bonnes surprises arrivent.</h3><p>Tu retrouveras ici les codes promo attribués à ton compte.</p><button type="button" className={styles.primaryAction} onClick={() => setActiveTabAndSync("missions")}>Découvrir les quêtes <ArrowUpRight size={16} /></button></div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {user.promoCodes.map((promo) => (
                    <article key={`${promo.code}-${promo.createdAt}`} className="card-cartoon bg-white p-4">
                      <p className="text-lg font-bold text-ink">{promo.code}</p>
                      <p className="text-sm text-charcoal">{promo.discountPercent}% de réduction</p>
                      <p className="mt-1 text-xs font-semibold text-ink">
                        {promo.used ? "Utilisé" : "Actif"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          </div>
        </div>
      </div>
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </section>
  );
}
