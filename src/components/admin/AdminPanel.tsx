"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultStore } from "@/data/default-store";
import { AdminTextCarousel } from "@/components/admin/AdminTextCarousel";
import { AdminCustomersPanel } from "@/components/admin/AdminCustomersPanel";
import { AdminPromosPanel } from "@/components/admin/AdminPromosPanel";
import {
  FRENCH_DEPARTMENTS,
  FRENCH_REGIONS,
  getDepartmentByName,
} from "@/data/france-geo";
import { VAT_RATE_OPTIONS, categoryLabels, type Product, type ProductCategory, type VatRate } from "@/data/products";
import { BlogImageUpload } from "@/components/admin/BlogImageUpload";
import { ProductAnalysisUpload } from "@/components/admin/ProductAnalysisUpload";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";
import { ProducerImageUpload } from "@/components/admin/ProducerImageUpload";
import { PRODUCT_IMAGE_MAX_COUNT } from "@/lib/product-image-policy";
import {
  BLOG_CATEGORY_OPTIONS,
  ORDER_STATUS_OPTIONS,
  type BlogPost,
  type BlogCategory,
  type CmsOrder,
  type CmsStore,
  type OrderStatus,
  type Producer,
} from "@/types/store";

const productCategoryOptions = Object.keys(categoryLabels) as ProductCategory[];
const blogCategoryOptions = [...BLOG_CATEGORY_OPTIONS];
const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Nouvelle",
  pending_payment: "Paiement en attente",
  paid: "Payee",
  processing: "En preparation",
  shipped: "Expediee",
  cancelled: "Annulee",
};
type AdminTab = "commandes" | "clients" | "promos" | "produits" | "copains" | "blog" | "textes";

const adminTabs: AdminTab[] = [
  "commandes",
  "clients",
  "promos",
  "produits",
  "copains",
  "blog",
  "textes",
];

const tabLabels: Record<AdminTab, string> = {
  commandes: "Commandes",
  clients: "Clients",
  promos: "Promos",
  produits: "Mes Produits",
  copains: "Coin des Copains",
  blog: "Blog",
  textes: "Textes",
};

function formatProducerLocation(department: string, region: string): string {
  return [department.trim(), region.trim()].filter(Boolean).join(", ") || "France";
}

function makeProduct(): Product {
  return {
    id: `product-${Date.now()}`,
    name: "Nouveau produit",
    category: "fleurs",
    price: 0,
    vatRate: 20,
    image: "/product_flower.jpg",
    images: ["/product_flower.jpg"],
    analysisPdf: undefined,
    description: "Description du produit",
    badge: "",
  };
}

function makeProducer(): Producer {
  return {
    id: `producer-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    name: "Nouveau producteur",
    description: "Presentation du producteur partenaire.",
    image: "/product_flower.jpg",
    location: "France",
    department: "",
    region: "",
    website: "",
  };
}

function sanitizeBlogSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function generateUniqueBlogSlug(
  posts: BlogPost[],
  source: string,
  currentId?: string,
): string {
  const base = sanitizeBlogSlug(source) || `article-${Date.now().toString().slice(-8)}`;
  let candidate = base;
  let suffix = 2;

  while (
    posts.some((post) => post.slug === candidate && (!currentId || post.id !== currentId))
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function makeBlogPost(existingPosts: BlogPost[]): BlogPost {
  const now = new Date().toISOString();
  const id = `blog-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const title = "Nouvel article";
  const slug = generateUniqueBlogSlug(existingPosts, title, id);

  return {
    id,
    title,
    slug,
    excerpt: "Resume de l'article",
    content: "Contenu de l'article.",
    coverImage: "/product_flower.jpg",
    category: "guide",
    published: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function AdminPanel() {
  const router = useRouter();
  const [draft, setDraft] = useState<CmsStore>(() => ({
    ...defaultStore,
    // Keep the first SSR/CSR render identical to avoid hydration mismatch.
    updatedAt: "",
  }));
  const [status, setStatus] = useState<string>("Chargement...");
  const [saving, setSaving] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | OrderStatus>("all");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("commandes");

  const updatedLabel = useMemo(() => {
    if (!draft.updatedAt) {
      return "-";
    }

    return new Date(draft.updatedAt).toLocaleString("fr-FR");
  }, [draft.updatedAt]);

  const filteredOrders = useMemo(() => {
    const search = orderSearch.trim().toLowerCase();
    const from = orderDateFrom ? new Date(`${orderDateFrom}T00:00:00`).getTime() : null;
    const to = orderDateTo ? new Date(`${orderDateTo}T23:59:59`).getTime() : null;

    return draft.orders.filter((order) => {
      if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) {
        return false;
      }

      const createdAt = new Date(order.createdAt).getTime();
      if (from && createdAt < from) {
        return false;
      }
      if (to && createdAt > to) {
        return false;
      }

      if (!search) {
        return true;
      }

      const inOrderId = order.id.toLowerCase().includes(search);
      const inItems = order.items.some((item) => item.name.toLowerCase().includes(search));
      const inCustomerEmail = (order.customerEmail ?? "").toLowerCase().includes(search);
      const inCustomerName = (order.customerName ?? "").toLowerCase().includes(search);
      const inCustomerId = (order.customerId ?? "").toLowerCase().includes(search);
      return inOrderId || inItems || inCustomerEmail || inCustomerName || inCustomerId;
    });
  }, [draft.orders, orderDateFrom, orderDateTo, orderSearch, orderStatusFilter]);

  const selectedBlog = useMemo(
    () => draft.blog.find((post) => post.id === selectedBlogId) ?? null,
    [draft.blog, selectedBlogId],
  );

  const productsWithIndex = useMemo(
    () => draft.products.map((product, index) => ({ product, index })),
    [draft.products],
  );
  const ownProducts = useMemo(
    () => productsWithIndex.filter(({ product }) => !product.producerId && !product.isPack),
    [productsWithIndex],
  );
  const partnerProducts = useMemo(
    () => productsWithIndex.filter(({ product }) => Boolean(product.producerId) && !product.isPack),
    [productsWithIndex],
  );

  const loadStore = async () => {
    setStatus("Chargement...");
    const response = await fetch("/api/admin/store", { cache: "no-store" });

    if (!response.ok) {
      setStatus("Impossible de charger les donnees.");
      return;
    }

    const data = (await response.json()) as CmsStore;
    setDraft(data);
    setSelectedBlogId((current) => {
      if (current && data.blog.some((post) => post.id === current)) {
        return current;
      }

      return data.blog[0]?.id ?? null;
    });
    setStatus("Donnees chargees.");
  };

  useEffect(() => {
    void loadStore();
  }, []);

  useEffect(() => {
    if (draft.blog.length === 0) {
      if (selectedBlogId !== null) {
        setSelectedBlogId(null);
      }
      return;
    }

    if (!selectedBlogId || !draft.blog.some((post) => post.id === selectedBlogId)) {
      setSelectedBlogId(draft.blog[0].id);
    }
  }, [draft.blog, selectedBlogId]);

  const saveStore = async () => {
    setSaving(true);
    setStatus("Sauvegarde en cours...");

    try {
      const response = await fetch("/api/admin/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        setStatus("Erreur de sauvegarde.");
        return;
      }

      const saved = (await response.json()) as CmsStore;
      setDraft(saved);
      setStatus("Sauvegarde effectuee.");
    } finally {
      setSaving(false);
    }
  };

  const updateOrderStatusDraft = (orderId: string, nextStatus: OrderStatus) => {
    setDraft((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order,
      ),
    }));
  };

  const saveOrderStatus = async (order: CmsOrder) => {
    setUpdatingOrderId(order.id);
    setStatus(`Mise a jour statut ${order.id}...`);

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: order.status }),
      });

      if (!response.ok) {
        setStatus("Erreur de mise a jour commande.");
        return;
      }

      const updated = (await response.json()) as CmsOrder;

      setDraft((current) => ({
        ...current,
        orders: current.orders.map((item) => (item.id === updated.id ? updated : item)),
      }));
      setStatus(`Commande ${updated.id} mise a jour.`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const markOrderAsPaid = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    setStatus(`Validation manuelle du paiement ${orderId}...`);

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentState: "paid" }),
      });

      if (!response.ok) {
        setStatus("Erreur de validation paiement.");
        return;
      }

      const updated = (await response.json()) as CmsOrder;
      setDraft((current) => ({
        ...current,
        orders: current.orders.map((item) => (item.id === updated.id ? updated : item)),
      }));
      setStatus(`Commande ${updated.id} marquee payee.`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const exportOrdersCsv = () => {
    const escapeCell = (value: string | number) =>
      `"${String(value).replaceAll("\"", "\"\"")}"`;

    const rows = [
      [
        "order_id",
        "created_at",
        "status",
        "payment_state",
        "customer_id",
        "customer_name",
        "customer_email",
        "items_count",
        "total_amount",
        "items",
      ].join(","),
      ...filteredOrders.map((order) =>
        [
          escapeCell(order.id),
          escapeCell(order.createdAt),
          escapeCell(order.status),
          escapeCell(order.paymentState),
          escapeCell(order.customerId ?? ""),
          escapeCell(order.customerName ?? ""),
          escapeCell(order.customerEmail ?? ""),
          escapeCell(order.itemsCount),
          escapeCell(order.totalAmount.toFixed(2)),
          escapeCell(
            order.items.map((item) => `${item.quantity}x ${item.name}`).join(" | "),
          ),
        ].join(","),
      ),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.setAttribute(
      "download",
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  const updateProduct = <K extends keyof Product>(
    index: number,
    key: K,
    value: Product[K],
  ) => {
    setDraft((current) => {
      const next = [...current.products];
      next[index] = { ...next[index], [key]: value };
      return { ...current, products: next };
    });
  };

  const removeProduct = (index: number) => {
    setDraft((current) => {
      const next = current.products.filter((_, i) => i !== index);
      return { ...current, products: next };
    });
  };

  const addProduct = () => {
    setDraft((current) => ({ ...current, products: [...current.products, makeProduct()] }));
  };

  const addPartnerProduct = () => {
    setDraft((current) => {
      const firstProducer = current.producers[0];
      if (!firstProducer) {
        return current;
      }

      return {
        ...current,
        products: [...current.products, { ...makeProduct(), producerId: firstProducer.id }],
      };
    });
  };

  const updateProductImages = (index: number, nextImages: string[]) => {
    const safeImages = nextImages.slice(0, PRODUCT_IMAGE_MAX_COUNT);
    const primaryImage = safeImages[0] ?? "/product_flower.jpg";

    setDraft((current) => {
      const next = [...current.products];
      next[index] = {
        ...next[index],
        image: primaryImage,
        images: safeImages,
      };
      return { ...current, products: next };
    });
  };

  const updateProductAnalysis = (
    index: number,
    nextAnalysisPath: string | undefined,
  ) => {
    setDraft((current) => {
      const next = [...current.products];
      next[index] = {
        ...next[index],
        analysisPdf: nextAnalysisPath,
      };
      return { ...current, products: next };
    });
  };

  const updateProducer = <K extends keyof Producer>(
    index: number,
    key: K,
    value: Producer[K],
  ) => {
    setDraft((current) => {
      const next = [...current.producers];
      next[index] = { ...next[index], [key]: value };
      return { ...current, producers: next };
    });
  };

  const updateProducerRegion = (index: number, nextRegion: string) => {
    setDraft((current) => {
      const next = [...current.producers];
      const producer = next[index];
      if (!producer) {
        return current;
      }

      const departmentBelongsToRegion =
        !producer.department ||
        FRENCH_DEPARTMENTS.some(
          (department) =>
            department.name === producer.department && department.region === nextRegion,
        );
      const nextDepartment = departmentBelongsToRegion ? producer.department : "";

      next[index] = {
        ...producer,
        region: nextRegion,
        department: nextDepartment,
        location: formatProducerLocation(nextDepartment, nextRegion),
      };

      return { ...current, producers: next };
    });
  };

  const updateProducerDepartment = (index: number, nextDepartment: string) => {
    setDraft((current) => {
      const next = [...current.producers];
      const producer = next[index];
      if (!producer) {
        return current;
      }

      const selectedDepartment = getDepartmentByName(nextDepartment);
      const nextRegion = selectedDepartment?.region ?? producer.region;

      next[index] = {
        ...producer,
        department: nextDepartment,
        region: nextRegion,
        location: formatProducerLocation(nextDepartment, nextRegion),
      };

      return { ...current, producers: next };
    });
  };

  const addProducer = () => {
    setDraft((current) => ({
      ...current,
      producers: [...current.producers, makeProducer()],
    }));
  };

  const removeProducer = (index: number) => {
    const producer = draft.producers[index];
    if (!producer) {
      return;
    }

    const shouldDelete = window.confirm(
      `Supprimer le producteur \"${producer.name}\" ?`,
    );
    if (!shouldDelete) {
      return;
    }

    setDraft((current) => ({
      ...current,
      producers: current.producers.filter((_, i) => i !== index),
    }));
  };

  const addBlogPost = () => {
    const nextPost = makeBlogPost(draft.blog);
    setSelectedBlogId(nextPost.id);
    setDraft((current) => ({ ...current, blog: [nextPost, ...current.blog] }));
  };

  const updateBlogPost = (postId: string, patch: Partial<BlogPost>) => {
    setDraft((current) => ({
      ...current,
      blog: current.blog.map((post) =>
        post.id === postId ? { ...post, ...patch, updatedAt: new Date().toISOString() } : post,
      ),
    }));
  };

  const updateBlogTitle = (postId: string, nextTitle: string) => {
    setDraft((current) => {
      const nextBlog = current.blog.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        const nextSlug = generateUniqueBlogSlug(current.blog, nextTitle, post.id);
        return {
          ...post,
          title: nextTitle,
          slug: nextSlug,
          updatedAt: new Date().toISOString(),
        };
      });

      return { ...current, blog: nextBlog };
    });
  };

  const updateBlogSlug = (postId: string, nextSlugSource: string) => {
    setDraft((current) => {
      const nextBlog = current.blog.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        const nextSlug = generateUniqueBlogSlug(current.blog, nextSlugSource, post.id);
        return {
          ...post,
          slug: nextSlug,
          updatedAt: new Date().toISOString(),
        };
      });

      return { ...current, blog: nextBlog };
    });
  };

  const removeBlogPost = (postId: string) => {
    const currentPost = draft.blog.find((post) => post.id === postId);
    if (!currentPost) {
      return;
    }

    const shouldDelete = window.confirm(
      `Supprimer l'article \"${currentPost.title}\" ?`,
    );
    if (!shouldDelete) {
      return;
    }

    setDraft((current) => ({
      ...current,
      blog: current.blog.filter((post) => post.id !== postId),
    }));

    if (selectedBlogId === postId) {
      const next = draft.blog.find((post) => post.id !== postId);
      setSelectedBlogId(next?.id ?? null);
    }
  };

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <div className="retro-container grid gap-8">
        <div className="cartoon-border bg-cream p-6 md:p-8">
          <h1 className="section-title">ADMIN BOUTIQUE</h1>
          <p className="mt-3 text-charcoal">
            Modifie les textes du site et la liste des produits depuis cet ecran.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="pill-cartoon px-3 py-1">Etat: {status}</span>
            <span className="pill-cartoon px-3 py-1">Derniere mise a jour: {updatedLabel}</span>
            <button type="button" onClick={loadStore} className="btn-cartoon btn-secondary">
              Recharger
            </button>
            <button type="button" onClick={saveStore} disabled={saving} className="btn-cartoon btn-primary">
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
            <button type="button" onClick={logout} className="btn-cartoon btn-secondary">
              Se deconnecter
            </button>
          </div>
        </div>

        <div className="cartoon-border bg-cream p-4 md:p-6">
          <div className="admin-tabs-row flex flex-nowrap gap-2 overflow-x-auto md:flex-wrap">
            {adminTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`pill-cartoon shrink-0 px-4 py-2 font-display text-sm transition-colors ${
                  activeTab === tab
                    ? "bg-[#1a1a1a] text-white"
                    : "bg-white text-ink hover:bg-[#f0f0f0]"
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "textes" && (
          <AdminTextCarousel draft={draft} setDraft={setDraft} />
        )}

        {activeTab === "commandes" && (
        <div className="cartoon-border bg-cream p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-3xl">Commandes recues ({draft.orders.length})</h2>
            <button
              type="button"
              className="btn-cartoon btn-secondary"
              onClick={exportOrdersCsv}
              disabled={filteredOrders.length === 0}
            >
              Export CSV
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              className="h-11 border-2 border-[#1a1a1a] bg-white px-3 md:col-span-2"
              placeholder="Recherche commande, produit ou client"
              value={orderSearch}
              onChange={(event) => setOrderSearch(event.target.value)}
            />
            <select
              className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
              value={orderStatusFilter}
              onChange={(event) =>
                setOrderStatusFilter(event.target.value as "all" | OrderStatus)
              }
            >
              <option value="all">Tous les statuts</option>
              {ORDER_STATUS_OPTIONS.map((statusValue) => (
                <option key={statusValue} value={statusValue}>
                  {orderStatusLabels[statusValue]}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                className="h-11 w-full border-2 border-[#1a1a1a] bg-white px-2"
                value={orderDateFrom}
                onChange={(event) => setOrderDateFrom(event.target.value)}
              />
              <input
                type="date"
                className="h-11 w-full border-2 border-[#1a1a1a] bg-white px-2"
                value={orderDateTo}
                onChange={(event) => setOrderDateTo(event.target.value)}
              />
            </div>
          </div>

          {filteredOrders.length === 0 && (
            <p className="mt-4 text-charcoal">
              Aucune commande ne correspond aux filtres.
            </p>
          )}
          <div className="mt-4 grid gap-4">
            {filteredOrders.map((order) => (
              <article key={order.id} className="card-cartoon bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{order.id}</p>
                    <p className="text-sm text-charcoal">
                      {new Date(order.createdAt).toLocaleString("fr-FR")} - {order.itemsCount} article(s)
                    </p>
                    <p className="text-sm font-semibold text-ink">
                      Total: {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(order.totalAmount)}
                    </p>
                    <p className="text-xs text-charcoal">
                      Client: {order.customerName || "Invite"}{order.customerEmail ? ` - ${order.customerEmail}` : ""}
                    </p>
                    <p className="text-xs text-charcoal">Paiement: {order.paymentState}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      value={order.status}
                      onChange={(e) => updateOrderStatusDraft(order.id, e.target.value as OrderStatus)}
                    >
                      {ORDER_STATUS_OPTIONS.map((statusValue) => (
                        <option key={statusValue} value={statusValue}>
                          {orderStatusLabels[statusValue]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => saveOrderStatus(order)}
                      disabled={updatingOrderId === order.id}
                      className="btn-cartoon btn-secondary"
                    >
                      {updatingOrderId === order.id ? "..." : "Mettre a jour"}
                    </button>
                    <button
                      type="button"
                      onClick={() => markOrderAsPaid(order.id)}
                      disabled={updatingOrderId === order.id || order.paymentState === "paid"}
                      className="btn-cartoon btn-primary"
                    >
                      {updatingOrderId === order.id
                        ? "..."
                        : order.paymentState === "paid"
                          ? "Deja payee"
                          : "Marquer payee"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  {order.items.map((item, idx) => (
                    <div key={`${order.id}-item-${idx}`} className="text-sm text-charcoal">
                      {item.quantity} x {item.name} -{" "}
                      {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(item.lineTotal)}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
        )}

        {activeTab === "clients" && <AdminCustomersPanel />}

        {activeTab === "promos" && (
          <AdminPromosPanel draft={draft} setDraft={setDraft} />
        )}

        {activeTab === "blog" && (
        <div className="cartoon-border bg-cream p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl">Blog ({draft.blog.length})</h2>
            <button type="button" className="btn-cartoon btn-secondary" onClick={addBlogPost}>
              Nouvel article
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
            <div className="grid gap-3">
              {draft.blog.length === 0 && (
                <p className="text-charcoal">Aucun article pour le moment.</p>
              )}
              {draft.blog.map((post) => (
                <article
                  key={post.id}
                  className={`card-cartoon p-3 ${
                    selectedBlog?.id === post.id ? "bg-[#e8f7f2]" : "bg-white"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedBlogId(post.id)}
                  >
                    <p className="font-semibold text-ink">{post.title}</p>
                    <p className="mt-1 text-xs text-charcoal">/{post.slug}</p>
                    <p className="mt-1 text-xs text-charcoal">
                      {post.published ? "Publie" : "Brouillon"} -{" "}
                      {new Date(post.updatedAt).toLocaleDateString("fr-FR")}
                    </p>
                  </button>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="btn-cartoon btn-primary h-9 px-3 text-xs"
                      onClick={() => removeBlogPost(post.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!selectedBlog ? (
              <div className="card-cartoon bg-white p-5 text-charcoal">
                Selectionne un article pour l&apos;editer.
              </div>
            ) : (
              <article className="card-cartoon bg-white p-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    value={selectedBlog.title}
                    onChange={(event) => updateBlogTitle(selectedBlog.id, event.target.value)}
                    placeholder="Titre"
                  />
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    value={selectedBlog.slug}
                    onChange={(event) => updateBlogSlug(selectedBlog.id, event.target.value)}
                    placeholder="slug"
                  />
                  <select
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    value={selectedBlog.category}
                    onChange={(event) =>
                      updateBlogPost(selectedBlog.id, {
                        category: event.target.value as BlogCategory,
                      })
                    }
                  >
                    {blogCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <label className="flex h-10 items-center gap-2 border-2 border-[#1a1a1a] px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedBlog.published}
                      onChange={(event) =>
                        updateBlogPost(selectedBlog.id, { published: event.target.checked })
                      }
                    />
                    Publie
                  </label>
                </div>

                <textarea
                  className="mt-3 min-h-20 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                  value={selectedBlog.excerpt}
                  onChange={(event) =>
                    updateBlogPost(selectedBlog.id, { excerpt: event.target.value })
                  }
                  placeholder="Extrait"
                />
                <textarea
                  className="mt-3 min-h-40 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                  value={selectedBlog.content}
                  onChange={(event) =>
                    updateBlogPost(selectedBlog.id, { content: event.target.value })
                  }
                  placeholder="Contenu texte brut (paragraphes separes par une ligne vide)"
                />
                <div className="mt-4">
                  <BlogImageUpload
                    value={selectedBlog.coverImage}
                    onChange={(nextImagePath) =>
                      updateBlogPost(selectedBlog.id, { coverImage: nextImagePath })
                    }
                  />
                </div>
                <p className="mt-3 text-xs text-charcoal">
                  Cree le {new Date(selectedBlog.createdAt).toLocaleString("fr-FR")} - Modifie le{" "}
                  {new Date(selectedBlog.updatedAt).toLocaleString("fr-FR")}
                </p>
              </article>
            )}
          </div>
        </div>
        )}

        {activeTab === "copains" && (
        <div className="cartoon-border bg-cream p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl">Producteurs Partenaires ({draft.producers.length})</h2>
            <button type="button" className="btn-cartoon btn-secondary" onClick={addProducer}>
              Ajouter un producteur
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            {draft.producers.length === 0 && (
              <p className="text-charcoal">Aucun producteur partenaire pour le moment.</p>
            )}
            {draft.producers.map((producer, index) => (
              <article key={`${producer.id}-${index}`} className="card-cartoon bg-white p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    value={producer.id}
                    onChange={(event) => updateProducer(index, "id", event.target.value)}
                    placeholder="id"
                  />
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    value={producer.name}
                    onChange={(event) => updateProducer(index, "name", event.target.value)}
                    placeholder="nom producteur"
                  />
                  <input
                    className="h-10 border-2 border-[#1a1a1a] bg-[#f4f4f4] px-2 text-sm"
                    value={formatProducerLocation(producer.department, producer.region)}
                    readOnly
                    placeholder="localisation"
                  />
                  <select
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-2 text-sm"
                    value={producer.region}
                    onChange={(event) => updateProducerRegion(index, event.target.value)}
                  >
                    <option value="">-- Region --</option>
                    {FRENCH_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-2 text-sm"
                    value={producer.department}
                    onChange={(event) =>
                      updateProducerDepartment(index, event.target.value)
                    }
                  >
                    <option value="">-- Departement --</option>
                    {(producer.region
                      ? FRENCH_DEPARTMENTS.filter(
                          (department) => department.region === producer.region,
                        )
                      : FRENCH_DEPARTMENTS
                    ).map((department) => (
                      <option key={department.code} value={department.name}>
                        {department.code} - {department.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    value={producer.website}
                    onChange={(event) => updateProducer(index, "website", event.target.value)}
                    placeholder="website (https://...)"
                  />
                </div>

                <textarea
                  className="mt-3 min-h-20 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                  value={producer.description}
                  onChange={(event) => updateProducer(index, "description", event.target.value)}
                  placeholder="description"
                />

                <div className="mt-3 grid gap-3 md:grid-cols-[1fr,auto] md:items-start">
                  <ProducerImageUpload
                    value={producer.image}
                    onChange={(nextImagePath) => updateProducer(index, "image", nextImagePath)}
                  />
                  <button
                    type="button"
                    onClick={() => removeProducer(index)}
                    className="btn-cartoon btn-primary h-10"
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
        )}

        {activeTab === "produits" && (
          <div className="cartoon-border bg-cream p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl">Mes Produits ({ownProducts.length})</h2>
              <button type="button" className="btn-cartoon btn-secondary" onClick={addProduct}>
                Ajouter un produit
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              {ownProducts.length === 0 && (
                <p className="text-charcoal">Aucun produit maison pour le moment.</p>
              )}
              {ownProducts.map(({ product, index }) => (
                <article key={`${product.id}-${index}`} className="card-cartoon bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-7">
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                      value={product.id}
                      onChange={(e) => updateProduct(index, "id", e.target.value)}
                      placeholder="id"
                    />
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                      value={product.name}
                      onChange={(e) => updateProduct(index, "name", e.target.value)}
                      placeholder="nom"
                    />
                    <select
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      value={product.category}
                      onChange={(e) =>
                        updateProduct(index, "category", e.target.value as ProductCategory)
                      }
                    >
                      {productCategoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabels[category]}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      value={product.price}
                      type="number"
                      step="0.01"
                      onChange={(e) => updateProduct(index, "price", Number(e.target.value) || 0)}
                      placeholder="prix"
                    />
                    <select
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      value={product.vatRate ?? 20}
                      onChange={(e) => updateProduct(index, "vatRate", Number(e.target.value) as VatRate)}
                    >
                      {VAT_RATE_OPTIONS.map((rate) => (
                        <option key={rate} value={rate}>
                          TVA {rate}%
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <ProductImageUpload
                      images={product.images ?? [product.image]}
                      onChange={(nextImagePaths) => updateProductImages(index, nextImagePaths)}
                    />
                    <ProductAnalysisUpload
                      value={product.analysisPdf}
                      onChange={(nextAnalysisPath) =>
                        updateProductAnalysis(index, nextAnalysisPath)
                      }
                    />
                  </div>
                  <div className="mt-3">
                    <input
                      className="h-10 w-full border-2 border-[#1a1a1a] px-2 text-sm"
                      value={product.badge ?? ""}
                      onChange={(e) => updateProduct(index, "badge", e.target.value)}
                      placeholder="badge"
                    />
                  </div>
                  <textarea
                    className="mt-3 min-h-20 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                    value={product.description}
                    onChange={(e) => updateProduct(index, "description", e.target.value)}
                    placeholder="description"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      className="btn-cartoon btn-primary"
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === "copains" && (
          <div className="cartoon-border bg-cream p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl">Produits Copains ({partnerProducts.length})</h2>
              <button
                type="button"
                className="btn-cartoon btn-secondary"
                onClick={addPartnerProduct}
                disabled={draft.producers.length === 0}
              >
                Ajouter un produit copain
              </button>
            </div>

            {draft.producers.length === 0 && (
              <p className="mt-4 text-charcoal">
                Cree d&apos;abord un producteur pour pouvoir ajouter un produit copain.
              </p>
            )}

            <div className="mt-6 grid gap-4">
              {partnerProducts.length === 0 && (
                <p className="text-charcoal">Aucun produit partenaire pour le moment.</p>
              )}
              {partnerProducts.map(({ product, index }) => (
                <article key={`${product.id}-${index}`} className="card-cartoon bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-9">
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                      value={product.id}
                      onChange={(e) => updateProduct(index, "id", e.target.value)}
                      placeholder="id"
                    />
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                      value={product.name}
                      onChange={(e) => updateProduct(index, "name", e.target.value)}
                      placeholder="nom"
                    />
                    <select
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      value={product.category}
                      onChange={(e) =>
                        updateProduct(index, "category", e.target.value as ProductCategory)
                      }
                    >
                      {productCategoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabels[category]}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      value={product.price}
                      type="number"
                      step="0.01"
                      onChange={(e) => updateProduct(index, "price", Number(e.target.value) || 0)}
                      placeholder="prix"
                    />
                    <select
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      value={product.vatRate ?? 20}
                      onChange={(e) => updateProduct(index, "vatRate", Number(e.target.value) as VatRate)}
                    >
                      {VAT_RATE_OPTIONS.map((rate) => (
                        <option key={rate} value={rate}>
                          TVA {rate}%
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                      value={product.producerId ?? ""}
                      onChange={(e) =>
                        updateProduct(index, "producerId", e.target.value.trim() || undefined)
                      }
                    >
                      <option value="">-- Produit maison --</option>
                      {draft.producers.map((producer) => (
                        <option key={producer.id} value={producer.id}>
                          {producer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <ProductImageUpload
                      images={product.images ?? [product.image]}
                      onChange={(nextImagePaths) => updateProductImages(index, nextImagePaths)}
                    />
                    <ProductAnalysisUpload
                      value={product.analysisPdf}
                      onChange={(nextAnalysisPath) =>
                        updateProductAnalysis(index, nextAnalysisPath)
                      }
                    />
                  </div>
                  <div className="mt-3">
                    <input
                      className="h-10 w-full border-2 border-[#1a1a1a] px-2 text-sm"
                      value={product.badge ?? ""}
                      onChange={(e) => updateProduct(index, "badge", e.target.value)}
                      placeholder="badge"
                    />
                  </div>
                  <textarea
                    className="mt-3 min-h-20 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                    value={product.description}
                    onChange={(e) => updateProduct(index, "description", e.target.value)}
                    placeholder="description"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      className="btn-cartoon btn-primary"
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
