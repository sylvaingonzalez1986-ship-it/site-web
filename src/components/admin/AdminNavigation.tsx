"use client";

import { BarChart3, BookOpen, Boxes, FileText, Gift, Mail, MessageSquare, Package, Percent, ShoppingBag, Sprout, Swords, Target, Truck, Users, UsersRound } from "lucide-react";
import styles from "./AdminWorkspace.module.css";

export type AdminTab = "commandes" | "ventes" | "clients" | "parrainage" | "missions" | "promos" | "loterie" | "newsletter" | "printful" | "concours" | "produits" | "copains" | "blog" | "blog_comments" | "pages" | "textes";

const groups = [
  { label: "La boutique", items: [
    { id: "commandes", label: "Commandes", icon: ShoppingBag },
    { id: "ventes", label: "Ventes", icon: BarChart3 },
    { id: "produits", label: "Mes produits", icon: Package },
    { id: "copains", label: "Coin des copains", icon: Sprout },
    { id: "promos", label: "Promos", icon: Percent },
    { id: "printful", label: "Printful", icon: Truck },
  ] },
  { label: "La communauté", items: [
    { id: "clients", label: "Clients", icon: Users },
    { id: "parrainage", label: "Parrainage", icon: UsersRound },
    { id: "missions", label: "Missions", icon: Target },
    { id: "concours", label: "L’Arène", icon: Swords },
    { id: "loterie", label: "Loterie", icon: Gift },
    { id: "newsletter", label: "Newsletter", icon: Mail },
  ] },
  { label: "Le contenu", items: [
    { id: "blog", label: "Blog", icon: BookOpen },
    { id: "blog_comments", label: "Commentaires", icon: MessageSquare },
    { id: "pages", label: "Pages", icon: FileText },
    { id: "textes", label: "Textes & visuels", icon: Boxes },
  ] },
] satisfies { label: string; items: { id: AdminTab; label: string; icon: typeof Package }[] }[];

export function AdminNavigation({ activeTab, onChange, showContest }: {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
  showContest: boolean;
}) {
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => item.id !== "concours" || showContest) }));

  return (
    <nav className={styles.navigation} aria-label="Rubriques de l’administration">
      <div className={styles.mobileNavigation}>
        <label htmlFor="admin-section">Rubrique</label>
        <select id="admin-section" value={activeTab} onChange={(event) => onChange(event.target.value as AdminTab)} aria-controls="admin-content">
          {visibleGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className={styles.desktopNavigation}>
        {visibleGroups.map((group) => (
          <div key={group.label} className={styles.navGroup}>
            <p>{group.label}</p>
            {group.items.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => onChange(id)} aria-current={activeTab === id ? "page" : undefined} aria-controls="admin-content">
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
