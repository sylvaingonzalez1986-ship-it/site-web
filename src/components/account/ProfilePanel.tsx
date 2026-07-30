"use client";

import Image from "next/image";
import Link from "next/link";
import { Award, Copy, Download, Gift, ShoppingBag, Star, Tag, User as UserIcon, Users, type LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  bookmarkLabel: string;
  icon: LucideIcon;
};

const profileTabs: ProfileTabDefinition[] = [
  { key: "fidelite", label: "Progression", bookmarkLabel: "Progression", icon: Award },
  { key: "missions", label: "Quêtes", bookmarkLabel: "Quêtes", icon: Star },
  { key: "commandes", label: "Commandes", bookmarkLabel: "Cmdes", icon: ShoppingBag },
  { key: "infos", label: "Mes infos", bookmarkLabel: "Infos", icon: UserIcon },
  { key: "promos", label: "Promos", bookmarkLabel: "Promos", icon: Tag },
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
        behavior: "smooth",
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
          <div className={styles.stateCard}>Chargement du profil...</div>
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

      setStatus("Profil mis a jour.");
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
          behavior: "smooth",
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
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Ton espace personnel</p>
          <h1 className={styles.heroTitle}>
            Mon <span>profil.</span>
          </h1>
          <p className={styles.heroLead}>
            Ta progression, tes quêtes et tout ce qui concerne ton compte sont réunis ici.
          </p>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <span className={styles.heroCircle} />
          <Image
            src="/charles.png"
            alt=""
            width={1536}
            height={2048}
            sizes="(max-width: 720px) 112px, 180px"
            priority
          />
        </div>
      </div>

      <div className={styles.shell}>
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
                aria-controls={`profile-tabpanel-${tab.key}`}
                onClick={() => setActiveTabAndSync(tab.key)}
                className={isActive ? styles.tabActive : undefined}
                data-tutorial={tab.key === "missions" ? "profile-missions-shortcut" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{tab.label}</span>
                {notification ? <strong>{notification}</strong> : null}
              </button>
            );
          })}
        </div>

        <div className={styles.profileGrid}>
          <aside className={styles.summaryPanel} aria-label="Résumé du profil">
                  <div className="rounded border-2 border-[#17130e] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                      Fiche client
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#17130e] bg-[#fffaf0] font-display text-2xl text-ink">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-black text-ink">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="break-all text-sm text-charcoal">{user.email}</p>
                        <p className="text-xs font-semibold text-charcoal">Membre depuis le {memberSince}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded border-2 border-[#17130e] bg-[#fff7df] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">
                        Points cumules
                      </p>
                      <p className="mt-1 text-2xl font-black text-ink">{loyalty.points}</p>
                    </div>
                    <div className="rounded border-2 border-[#17130e] bg-[#fff7df] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">
                        Disponibles
                      </p>
                      <p className="mt-1 text-2xl font-black text-ink">{loyalty.spendablePoints}</p>
                    </div>
                    <div className="rounded border-2 border-[#17130e] bg-[#fff7df] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">
                        Euros comptabilises
                      </p>
                      <p className="mt-1 text-xl font-black text-ink">{formatPrice(loyalty.totalEligibleSpend)}</p>
                    </div>
                    <div className="rounded border-2 border-[#17130e] bg-[#fff7df] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">
                        Commandes eligibles
                      </p>
                      <p className="mt-1 text-2xl font-black text-ink">{loyalty.eligibleOrdersCount}</p>
                    </div>
                  </div>

                  <div className="rounded border-2 border-[#17130e] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                      Badge actuel
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <LoyaltyBadgeIllustration
                        badgeId={loyalty.currentBadge.id}
                        unlocked={loyalty.currentBadge.unlocked}
                        size="md"
                      />
                      <div>
                        <p className="font-display text-3xl leading-none text-ink">
                          {loyalty.currentBadge.label}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-charcoal">
                          {loyalty.currentBadge.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={logout}
                      className="btn-cartoon btn-secondary inline-flex min-h-11 items-center justify-center px-4 text-xs leading-none"
                    >
                      Se deconnecter
                    </button>
                  </div>
          </aside>

          <div
            ref={activePanelRef}
            id={`profile-tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`profile-tab-${activeTab}`}
            className={styles.activePanel}
          >
            <div className={styles.panelHeading}>
              <span><ActiveTabIcon aria-hidden="true" /></span>
              <div>
                <p>Mon espace</p>
                <h2>{activeTabDefinition.label}</h2>
              </div>
            </div>

          {activeTab === "fidelite" && (
            <>
              <div className="card-cartoon bg-white p-6">
                <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Badge actuel</p>
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

                        return "Debloque ce badge pour activer l'avantage livraison";
                      })()}
                    </p>
                    {!loyalty.currentBadge.unlocked && (
                      <p className="mt-1 text-xs font-semibold text-charcoal">A debloquer</p>
                    )}
                  </div>
                </div>

                {loyalty.nextBadge ? (
                  <div className="mt-6">
                    <p className="text-sm text-charcoal">
                      Encore <span className="font-semibold text-ink">{loyalty.pointsToNextBadge} points</span> pour atteindre{" "}
                      <span className="font-semibold text-ink">{loyalty.nextBadge.label}</span>.
                    </p>
                    <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-[#1a1a1a] bg-white">
                      <div
                        className="h-full bg-[#0a7b61]"
                        style={{ width: `${loyalty.progressToNextBadge}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 text-sm font-semibold text-ink">Niveau maximal atteint.</p>
                )}
              </div>

              <div className="mt-4 card-cartoon bg-white p-4" data-tutorial="profile-referral">
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
                        ? `Code utilise: ${referralSummary.referredByCode}`
                        : "Aucun code parrain utilise"}
                    </p>
                  </div>
                </div>

                {referralSummary && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Filleuls</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-ink">
                        <Users size={16} /> {referralSummary.totalReferrals}
                      </p>
                    </div>
                    <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Recompenses</p>
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
                  Bonus par parrainage valide: {referralSummary?.config.referrerPoints ?? 0} pts
                  pour le parrain et {referralSummary?.config.refereePoints ?? 0} pts pour le filleul
                  apres la premiere commande payee du filleul.
                </p>
                <p className="mt-1 text-xs text-charcoal">
                  Le filleul obtient aussi 10% de remise automatique sur sa premiere commande.
                </p>

                {!referralSummary?.referredByCode && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr,auto] sm:items-center">
                    <input
                      type="text"
                      className="h-11 border-2 border-[#1a1a1a] bg-white px-3 text-sm uppercase"
                      placeholder="J'ai un code parrain"
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
                  <p className="mt-2 text-xs font-semibold text-charcoal">Mise a jour parrainage...</p>
                )}
                {referralStatus && <p className="mt-2 text-xs font-semibold text-green-700">{referralStatus}</p>}
                {referralError && <p className="mt-2 text-xs font-semibold text-red-700">{referralError}</p>}
                {copyStatus && <p className="mt-2 text-xs font-semibold text-ink">{copyStatus}</p>}
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-3xl">Mes badges</h2>
                  <p className="text-sm text-charcoal">1 EUR depense = 1 point</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {loyalty.badges.map((badge) => (
                    <div key={badge.id} className="group relative">
                      <article
                        className={`card-cartoon h-full p-4 text-left transition-colors hover:bg-[#f7f4ee] ${
                          badge.unlocked ? "bg-[#e8f7f2]" : "bg-white"
                        }`}
                        tabIndex={0}
                      >
                        <div className="mb-3">
                          <LoyaltyBadgeIllustration badgeId={badge.id} unlocked={badge.unlocked} />
                        </div>
                        <p className="text-xs uppercase tracking-[0.08em] text-charcoal">{badge.minPoints}+ pts</p>
                        <p className="mt-1 font-semibold text-ink">{badge.label}</p>
                        <p className="mt-1 text-xs text-charcoal">{badge.description}</p>
                        <p className="mt-2 text-xs font-semibold text-ink">
                          {badge.unlocked ? "Debloque" : "Verrouille"}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-charcoal">Survole pour voir les avantages</p>
                      </article>
                      <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-3 w-[min(20rem,90vw)] -translate-x-1/2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                        <div className="card-cartoon bg-white p-4 text-left shadow-lg">
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-charcoal">
                            {popupTitle}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-ink">
                            {badge.label} - {badge.minPoints}+ points
                          </p>
                          <p className="mt-1 text-xs font-semibold text-ink">
                            Reduction permanente: {getBadgeDiscountPercent(profileContent, badge.id)}%
                          </p>
                          <p className="mt-1 text-xs font-semibold text-ink">
                            Livraison: {`${getBadgeTierRelayBenefitLabel(badge.id)} / ${getBadgeTierHomeDeliveryBenefitLabel(badge.id)}`}
                          </p>
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                            {popupHint}
                          </p>
                          {(() => {
                            const benefits = parseBadgeBenefitsLines(
                              getBadgeBenefitsText(profileContent, badge.id),
                            );
                            if (benefits.length === 0) {
                              return (
                                <p className="mt-2 text-xs text-charcoal">
                                  Aucun avantage specifique configure pour ce palier.
                                </p>
                              );
                            }

                            return (
                              <ul className="mt-2 grid gap-1 text-xs text-ink">
                                {benefits.map((benefit, index) => (
                                  <li key={`${badge.id}-benefit-${index}`} className="leading-relaxed">
                                    - {benefit}
                                  </li>
                                ))}
                              </ul>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "missions" && <MissionsSection />}

          {activeTab === "commandes" && (
            <>
              <h2 className="font-display text-3xl">Mes commandes ({sortedOrders.length})</h2>
              {sortedOrders.length === 0 && (
                <p className="mt-4 text-charcoal">Aucune commande pour le moment.</p>
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
              <h2 className="font-display text-3xl">Mes informations</h2>
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
              <form onSubmit={onSubmit} className="mt-6 grid gap-3 md:grid-cols-2">
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Prenom"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Nom"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-[#f4f4f4] px-3 text-base md:col-span-2"
                  value={user.email}
                  readOnly
                  placeholder="Email"
                />
                <label className="grid gap-1.5 md:col-span-2">
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
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Téléphone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base md:col-span-2"
                  placeholder="Adresse"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Ville"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Code postal"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base md:col-span-2"
                  placeholder="Pays"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-cartoon btn-primary inline-flex h-12 items-center justify-center leading-none md:col-span-2"
                >
                  {saving ? "Sauvegarde..." : "Mettre a jour le profil"}
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
                      <h3 className="text-lg font-bold text-ink">Exporter mes donnees</h3>
                      <p className="mt-1 text-sm leading-relaxed text-charcoal">
                        Telecharge une copie JSON des donnees associees a ton compte.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadPersonalData}
                    disabled={exportingData}
                    className="btn-cartoon btn-secondary mt-4 inline-flex h-11 items-center justify-center px-4 text-xs leading-none"
                  >
                    {exportingData ? "Preparation..." : "Telecharger mes donnees"}
                  </button>
                  {exportStatus && (
                    <p className="mt-3 text-sm font-semibold text-ink">{exportStatus}</p>
                  )}
                </article>

                <article className="card-cartoon bg-[#fff7e4] p-5">
                  <h3 className="text-lg font-bold text-ink">Vie privee</h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal">
                    Consulte la politique de confidentialite et la politique cookies pour comprendre
                    les traitements appliques a tes donnees.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/politique-confidentialite" className="btn-cartoon btn-secondary inline-flex h-11 items-center justify-center px-4 text-xs leading-none">
                      Politique de confidentialite
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
                  La suppression du compte est irreversible. Les commandes sont conservees pour les
                  obligations comptables, mais les donnees personnelles associees sont anonymisees.
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
              <h2 className="font-display text-3xl">Mes codes promo</h2>
              {user.promoCodes.length === 0 ? (
                <p className="mt-4 text-charcoal">Aucun code promo attribue pour le moment.</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {user.promoCodes.map((promo) => (
                    <article key={`${promo.code}-${promo.createdAt}`} className="card-cartoon bg-white p-4">
                      <p className="text-lg font-bold text-ink">{promo.code}</p>
                      <p className="text-sm text-charcoal">{promo.discountPercent}% de reduction</p>
                      <p className="mt-1 text-xs font-semibold text-ink">
                        {promo.used ? "Utilise" : "Actif"}
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
