"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultStore } from "@/data/default-store";
import { AdminTextCarousel } from "@/components/admin/AdminTextCarousel";
import { AdminSeasonGalleryManager } from "@/components/admin/AdminSeasonGalleryManager";
import { AdminPagesPanel } from "@/components/admin/AdminPagesPanel";
import { AdminCustomersPanel } from "@/components/admin/AdminCustomersPanel";
import { AdminReferralsPanel } from "@/components/admin/AdminReferralsPanel";
import { AdminPromosPanel } from "@/components/admin/AdminPromosPanel";
import { AdminLotteryPanel } from "@/components/admin/AdminLotteryPanel";
import { AdminNewsletterPanel } from "@/components/admin/AdminNewsletterPanel";
import { AdminOrderDetailModal } from "@/components/admin/AdminOrderDetailModal";
import { AdminPrintfulPanel } from "@/components/admin/AdminPrintfulPanel";
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
  PRODUCER_CULTURE_LABELS,
  PRODUCER_CULTURE_TYPES,
  type BlogPost,
  type BlogCategory,
  type CmsOrder,
  type CmsStore,
  type OrderStatus,
  type Producer,
  type ProducerCultureType,
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
type AdminTab =
  | "commandes"
  | "clients"
  | "parrainage"
  | "promos"
  | "loterie"
  | "newsletter"
  | "printful"
  | "produits"
  | "copains"
  | "blog"
  | "pages"
  | "textes";

const adminTabs: AdminTab[] = [
  "commandes",
  "clients",
  "parrainage",
  "promos",
  "loterie",
  "newsletter",
  "printful",
  "produits",
  "copains",
  "blog",
  "pages",
  "textes",
];

const tabLabels: Record<AdminTab, string> = {
  commandes: "Commandes",
  clients: "Clients",
  parrainage: "Parrainage",
  promos: "Promos",
  loterie: "Loterie",
  newsletter: "Newsletter",
  printful: "Printful",
  produits: "Mes Produits",
  copains: "Coin des Copains",
  blog: "Blog",
  pages: "Pages",
  textes: "Textes",
};

function formatProducerLocation(department: string, region: string): string {
  return [department.trim(), region.trim()].filter(Boolean).join(", ") || "France";
}

function parseProducerCertificationsInput(value: string): string[] {
  const nextValues: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of value.split(",")) {
    const certification = rawValue.trim();
    const key = certification.toLowerCase();
    if (!certification || seen.has(key)) {
      continue;
    }
    seen.add(key);
    nextValues.push(certification);
  }

  return nextValues;
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
    cultureType: [],
    climate: "",
    soil: "",
    altitude: "",
    certifications: [],
    speciality: "",
    philosophy: "",
    experience: "",
    founded: "",
  };
}

function makeVariantOption(nextIndex: number): NonNullable<Product["variantOptions"]>[number] {
  return {
    id: `variant-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    label: `Format ${nextIndex}`,
    price: 0,
    enabled: true,
    inStock: true,
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
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
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
  const selectedOrder = useMemo(
    () => draft.orders.find((order) => order.id === selectedOrderId) ?? null,
    [draft.orders, selectedOrderId],
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
  const selectedProducer = useMemo(
    () => draft.producers.find((producer) => producer.id === selectedProducerId) ?? null,
    [draft.producers, selectedProducerId],
  );
  const selectedProducerIndex = useMemo(
    () => draft.producers.findIndex((producer) => producer.id === selectedProducerId),
    [draft.producers, selectedProducerId],
  );
  const selectedProducerProducts = useMemo(
    () =>
      partnerProducts.filter(
        ({ product }) => Boolean(product.producerId) && product.producerId === selectedProducerId,
      ),
    [partnerProducts, selectedProducerId],
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

  useEffect(() => {
    if (draft.producers.length === 0) {
      if (selectedProducerId !== null) {
        setSelectedProducerId(null);
      }
      return;
    }

    if (!selectedProducerId || !draft.producers.some((producer) => producer.id === selectedProducerId)) {
      setSelectedProducerId(draft.producers[0].id);
    }
  }, [draft.producers, selectedProducerId]);

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

  const addPartnerProductForProducer = (producerId: string) => {
    setDraft((current) => {
      const selected = current.producers.find((producer) => producer.id === producerId);
      if (!selected) {
        return current;
      }

      return {
        ...current,
        products: [...current.products, { ...makeProduct(), producerId: selected.id }],
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

  const addVariantOptionToProduct = (productIndex: number) => {
    setDraft((current) => {
      const nextProducts = [...current.products];
      const product = nextProducts[productIndex];
      if (!product) {
        return current;
      }

      const nextVariantOptions = Array.isArray(product.variantOptions)
        ? [...product.variantOptions]
        : [];
      nextVariantOptions.push(makeVariantOption(nextVariantOptions.length + 1));

      nextProducts[productIndex] = {
        ...product,
        variantLabel: product.variantLabel?.trim() || "Format",
        variantOptions: nextVariantOptions,
      };

      return { ...current, products: nextProducts };
    });
  };

  const removeVariantOptionFromProduct = (productIndex: number, optionIndex: number) => {
    setDraft((current) => {
      const nextProducts = [...current.products];
      const product = nextProducts[productIndex];
      if (!product || !Array.isArray(product.variantOptions)) {
        return current;
      }

      const nextVariantOptions = product.variantOptions.filter((_, index) => index !== optionIndex);
      nextProducts[productIndex] = {
        ...product,
        variantOptions: nextVariantOptions.length > 0 ? nextVariantOptions : undefined,
        variantLabel: nextVariantOptions.length > 0 ? product.variantLabel : undefined,
      };

      return { ...current, products: nextProducts };
    });
  };

  const updateVariantOptionForProduct = (
    productIndex: number,
    optionIndex: number,
    patch: Partial<NonNullable<Product["variantOptions"]>[number]>,
  ) => {
    setDraft((current) => {
      const nextProducts = [...current.products];
      const product = nextProducts[productIndex];
      if (!product || !Array.isArray(product.variantOptions)) {
        return current;
      }

      const nextVariantOptions = [...product.variantOptions];
      const currentOption = nextVariantOptions[optionIndex];
      if (!currentOption) {
        return current;
      }

      nextVariantOptions[optionIndex] = { ...currentOption, ...patch };
      nextProducts[productIndex] = {
        ...product,
        variantOptions: nextVariantOptions,
      };

      return { ...current, products: nextProducts };
    });
  };

  const renderVariantEditor = (product: Product, index: number) => {
    const variantOptions = Array.isArray(product.variantOptions) ? product.variantOptions : [];

    return (
      <div className="mt-3 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
              Intitule format
            </span>
            <input
              className="mt-1 h-10 w-full border-2 border-[#1a1a1a] bg-white px-2 text-sm"
              value={product.variantLabel ?? ""}
              onChange={(event) => updateProduct(index, "variantLabel", event.target.value)}
              placeholder="Format (ex: Poids, Taille, Pack)"
            />
          </label>
          <button
            type="button"
            className="btn-cartoon btn-secondary h-10 px-3 text-xs"
            onClick={() => addVariantOptionToProduct(index)}
          >
            Ajouter un format
          </button>
        </div>

        {variantOptions.length === 0 ? (
          <p className="mt-2 text-xs text-charcoal">
            Aucun format configure. Exemple: 5g, 10g, 20g.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {variantOptions.map((option, optionIndex) => (
              <div
                key={`${option.id}-${optionIndex}`}
                className="grid gap-2 rounded border border-[#1a1a1a] bg-white p-2 md:grid-cols-[2fr,1fr,auto,auto,1fr,auto] md:items-center"
              >
                <input
                  className="h-9 border-2 border-[#1a1a1a] px-2 text-xs"
                  value={option.label}
                  onChange={(event) =>
                    updateVariantOptionForProduct(index, optionIndex, {
                      label: event.target.value,
                    })
                  }
                  placeholder="Label format (ex: 10g)"
                />
                <input
                  className="h-9 border-2 border-[#1a1a1a] px-2 text-xs"
                  value={option.price}
                  type="number"
                  min={0}
                  step="0.01"
                  onChange={(event) =>
                    updateVariantOptionForProduct(index, optionIndex, {
                      price: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                  placeholder="Prix"
                />
                <label className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                  <input
                    type="checkbox"
                    checked={option.enabled !== false}
                    onChange={(event) =>
                      updateVariantOptionForProduct(index, optionIndex, {
                        enabled: event.target.checked,
                      })
                    }
                  />
                  Actif
                </label>
                <label className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                  <input
                    type="checkbox"
                    checked={option.inStock !== false}
                    onChange={(event) =>
                      updateVariantOptionForProduct(index, optionIndex, {
                        inStock: event.target.checked,
                      })
                    }
                  />
                  Stock
                </label>
                <input
                  className="h-9 border-2 border-[#1a1a1a] px-2 text-xs"
                  value={option.stockQuantity ?? ""}
                  type="number"
                  min={0}
                  step={1}
                  onChange={(event) =>
                    updateVariantOptionForProduct(index, optionIndex, {
                      stockQuantity:
                        event.target.value === ""
                          ? undefined
                          : Math.max(0, Math.floor(Number(event.target.value) || 0)),
                    })
                  }
                  placeholder="Qte (optionnel)"
                />
                <button
                  type="button"
                  className="btn-cartoon btn-primary h-9 px-3 text-xs"
                  onClick={() => removeVariantOptionFromProduct(index, optionIndex)}
                >
                  Suppr.
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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

  const toggleProducerCultureType = (index: number, cultureType: ProducerCultureType) => {
    setDraft((current) => {
      const next = [...current.producers];
      const producer = next[index];
      if (!producer) {
        return current;
      }

      const currentCultureTypes = Array.isArray(producer.cultureType)
        ? producer.cultureType
        : [];
      const hasCultureType = currentCultureTypes.includes(cultureType);
      const nextCultureTypes = hasCultureType
        ? currentCultureTypes.filter((entry) => entry !== cultureType)
        : [...currentCultureTypes, cultureType];

      next[index] = {
        ...producer,
        cultureType: nextCultureTypes,
      };

      return { ...current, producers: next };
    });
  };

  const addProducer = () => {
    const nextProducer = makeProducer();
    setDraft((current) => ({
      ...current,
      producers: [...current.producers, nextProducer],
    }));
    setSelectedProducerId(nextProducer.id);
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
      products: current.products.filter((product) => product.producerId !== producer.id),
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
          <div className="grid gap-6">
            <AdminTextCarousel draft={draft} setDraft={setDraft} />
            <AdminSeasonGalleryManager draft={draft} setDraft={setDraft} />
          </div>
        )}

        {activeTab === "pages" && <AdminPagesPanel />}

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
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className="btn-cartoon btn-secondary"
                    >
                      Detail
                    </button>
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

        {activeTab === "parrainage" && <AdminReferralsPanel />}

        {activeTab === "promos" && (
          <AdminPromosPanel draft={draft} setDraft={setDraft} />
        )}

        {activeTab === "loterie" && <AdminLotteryPanel />}

        {activeTab === "newsletter" && <AdminNewsletterPanel />}

        {activeTab === "printful" && <AdminPrintfulPanel />}

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
                  {renderVariantEditor(product, index)}
                  <div className="mt-3 grid gap-3 md:grid-cols-[auto,1fr] md:items-center">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
                      <input
                        type="checkbox"
                        checked={product.trackStock === true}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          updateProduct(index, "trackStock", enabled);
                          if (!enabled) {
                            updateProduct(index, "stockQuantity", undefined);
                          } else if (!Number.isFinite(Number(product.stockQuantity))) {
                            updateProduct(index, "stockQuantity", 0);
                          }
                        }}
                      />
                      Suivre stock
                    </label>
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm disabled:opacity-50"
                      value={product.trackStock ? (product.stockQuantity ?? 0) : ""}
                      type="number"
                      min={0}
                      step={1}
                      disabled={product.trackStock !== true}
                      onChange={(event) =>
                        updateProduct(
                          index,
                          "stockQuantity",
                          Math.max(0, Math.floor(Number(event.target.value) || 0)),
                        )
                      }
                      placeholder="Quantite stock"
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
              <h2 className="font-display text-3xl">Coin des Copains</h2>
              <button type="button" className="btn-cartoon btn-secondary" onClick={addProducer}>
                Ajouter un producteur
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
              <aside className="card-cartoon bg-white p-4">
                <h3 className="font-display text-2xl">Producteurs ({draft.producers.length})</h3>
                <div className="mt-3 grid gap-2">
                  {draft.producers.length === 0 && (
                    <p className="text-sm text-charcoal">
                      Aucun producteur partenaire pour le moment.
                    </p>
                  )}
                  {draft.producers.map((producer) => (
                    <button
                      key={producer.id}
                      type="button"
                      onClick={() => setSelectedProducerId(producer.id)}
                      className={`rounded border-2 px-3 py-2 text-left transition-colors ${
                        selectedProducerId === producer.id
                          ? "border-[#1a1a1a] bg-[#e8f7f2]"
                          : "border-[#1a1a1a] bg-white hover:bg-[#f7f4ee]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-ink">{producer.name || "Sans nom"}</p>
                      <p className="text-xs text-charcoal">
                        {formatProducerLocation(producer.department, producer.region)}
                      </p>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="grid gap-4">
                {!selectedProducer || selectedProducerIndex < 0 ? (
                  <div className="card-cartoon bg-white p-5 text-charcoal">
                    Selectionne un producteur pour gerer sa fiche et ses produits.
                  </div>
                ) : (
                  <>
                    <article className="card-cartoon bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                          value={selectedProducer.id}
                          onChange={(event) =>
                            updateProducer(selectedProducerIndex, "id", event.target.value)
                          }
                          placeholder="id"
                        />
                        <input
                          className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                          value={selectedProducer.name}
                          onChange={(event) =>
                            updateProducer(selectedProducerIndex, "name", event.target.value)
                          }
                          placeholder="nom producteur"
                        />
                        <input
                          className="h-10 border-2 border-[#1a1a1a] bg-[#f4f4f4] px-2 text-sm"
                          value={formatProducerLocation(selectedProducer.department, selectedProducer.region)}
                          readOnly
                          placeholder="localisation"
                        />
                        <select
                          className="h-10 border-2 border-[#1a1a1a] bg-white px-2 text-sm"
                          value={selectedProducer.region}
                          onChange={(event) =>
                            updateProducerRegion(selectedProducerIndex, event.target.value)
                          }
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
                          value={selectedProducer.department}
                          onChange={(event) =>
                            updateProducerDepartment(selectedProducerIndex, event.target.value)
                          }
                        >
                          <option value="">-- Departement --</option>
                          {(selectedProducer.region
                            ? FRENCH_DEPARTMENTS.filter(
                                (department) => department.region === selectedProducer.region,
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
                          value={selectedProducer.website}
                          onChange={(event) =>
                            updateProducer(selectedProducerIndex, "website", event.target.value)
                          }
                          placeholder="website (https://...)"
                        />
                      </div>

                      <textarea
                        className="mt-3 min-h-20 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                        value={selectedProducer.description}
                        onChange={(event) =>
                          updateProducer(selectedProducerIndex, "description", event.target.value)
                        }
                        placeholder="description"
                      />

                      <div className="admin-field-group mt-4 grid gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-charcoal">
                          Donnees carte TCG
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {PRODUCER_CULTURE_TYPES.map((cultureType) => {
                            const active = (selectedProducer.cultureType ?? []).includes(cultureType);
                            return (
                              <button
                                key={cultureType}
                                type="button"
                                onClick={() =>
                                  toggleProducerCultureType(selectedProducerIndex, cultureType)
                                }
                                className={`pill-cartoon px-3 py-1 text-xs uppercase tracking-[0.08em] transition-colors ${
                                  active
                                    ? "bg-[#1a1a1a] text-white"
                                    : "bg-white text-ink hover:bg-[#f4f4f4]"
                                }`}
                                aria-pressed={active}
                              >
                                {PRODUCER_CULTURE_LABELS[cultureType]}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                            value={selectedProducer.climate}
                            onChange={(event) =>
                              updateProducer(selectedProducerIndex, "climate", event.target.value)
                            }
                            placeholder="climat (ex: Oceanique)"
                          />
                          <input
                            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                            value={selectedProducer.soil}
                            onChange={(event) =>
                              updateProducer(selectedProducerIndex, "soil", event.target.value)
                            }
                            placeholder="sol / terroir"
                          />
                          <input
                            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                            value={selectedProducer.altitude}
                            onChange={(event) =>
                              updateProducer(selectedProducerIndex, "altitude", event.target.value)
                            }
                            placeholder="altitude"
                          />
                          <input
                            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                            value={selectedProducer.speciality}
                            onChange={(event) =>
                              updateProducer(selectedProducerIndex, "speciality", event.target.value)
                            }
                            placeholder="specialite"
                          />
                          <input
                            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                            value={selectedProducer.experience}
                            onChange={(event) =>
                              updateProducer(selectedProducerIndex, "experience", event.target.value)
                            }
                            placeholder="experience (ex: 8 ans)"
                          />
                          <input
                            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                            value={selectedProducer.founded}
                            onChange={(event) =>
                              updateProducer(selectedProducerIndex, "founded", event.target.value)
                            }
                            placeholder="annee de creation"
                          />
                        </div>

                        <input
                          className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                          value={(selectedProducer.certifications ?? []).join(", ")}
                          onChange={(event) =>
                            updateProducer(
                              selectedProducerIndex,
                              "certifications",
                              parseProducerCertificationsInput(event.target.value),
                            )
                          }
                          placeholder="certifications (separees par des virgules)"
                        />

                        <textarea
                          className="min-h-16 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                          value={selectedProducer.philosophy}
                          onChange={(event) =>
                            updateProducer(selectedProducerIndex, "philosophy", event.target.value)
                          }
                          placeholder="philosophie (phrase courte)"
                        />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr,auto] md:items-start">
                        <ProducerImageUpload
                          value={selectedProducer.image}
                          onChange={(nextImagePath) =>
                            updateProducer(selectedProducerIndex, "image", nextImagePath)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeProducer(selectedProducerIndex)}
                          className="btn-cartoon btn-primary h-10"
                        >
                          Supprimer producteur (+ ses produits)
                        </button>
                      </div>
                    </article>

                    <article className="card-cartoon bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display text-2xl">
                          Produits de {selectedProducer.name} ({selectedProducerProducts.length})
                        </h3>
                        <button
                          type="button"
                          className="btn-cartoon btn-secondary"
                          onClick={() => addPartnerProductForProducer(selectedProducer.id)}
                        >
                          Ajouter un produit
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4">
                        {selectedProducerProducts.length === 0 && (
                          <p className="text-charcoal">Aucun produit pour ce producteur.</p>
                        )}
                        {selectedProducerProducts.map(({ product, index }) => (
                          <article key={`${product.id}-${index}`} className="rounded border-2 border-[#1a1a1a] bg-[#fdfcf9] p-4">
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
                                onChange={(e) =>
                                  updateProduct(index, "vatRate", Number(e.target.value) as VatRate)
                                }
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
                            {renderVariantEditor(product, index)}
                            <div className="mt-3 grid gap-3 md:grid-cols-[auto,1fr] md:items-center">
                              <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
                                <input
                                  type="checkbox"
                                  checked={product.trackStock === true}
                                  onChange={(event) => {
                                    const enabled = event.target.checked;
                                    updateProduct(index, "trackStock", enabled);
                                    if (!enabled) {
                                      updateProduct(index, "stockQuantity", undefined);
                                    } else if (!Number.isFinite(Number(product.stockQuantity))) {
                                      updateProduct(index, "stockQuantity", 0);
                                    }
                                  }}
                                />
                                Suivre stock
                              </label>
                              <input
                                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm disabled:opacity-50"
                                value={product.trackStock ? (product.stockQuantity ?? 0) : ""}
                                type="number"
                                min={0}
                                step={1}
                                disabled={product.trackStock !== true}
                                onChange={(event) =>
                                  updateProduct(
                                    index,
                                    "stockQuantity",
                                    Math.max(0, Math.floor(Number(event.target.value) || 0)),
                                  )
                                }
                                placeholder="Quantite stock"
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
                    </article>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedOrder && (
          <AdminOrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrderId(null)}
          />
        )}
      </div>
    </section>
  );
}
