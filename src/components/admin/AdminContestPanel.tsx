"use client";

import { Check, Plus, RefreshCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";
import type { Product } from "@/data/products";
import {
  CANNABIS_CANNABINOID_CODES,
  CANNABIS_CANNABINOID_OPTIONS,
  normalizeContestCannabinoid,
  type ContestCannabinoidRate,
} from "@/lib/contest-cannabinoids";
import {
  CANNABIS_TERPENE_CODES,
  CANNABIS_TERPENE_OPTIONS,
  normalizeContestTerpene,
} from "@/lib/contest-terpenes";
import { formatContestAverage, getContestReviewAverage } from "@/lib/contest-ui";
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";
import type { Producer } from "@/types/store";
import {
  CONTEST_CONSUMPTION_METHOD_LABELS,
  CONTEST_ENTRY_CATEGORIES,
  CONTEST_ENTRY_CATEGORY_LABELS,
  CONTEST_ENTRY_TRACKS,
  CONTEST_ENTRY_TRACK_LABELS,
  CONTEST_REVIEW_STATUS_LABELS,
  type ContestEntryInput,
  type ContestEntrySummary,
  type ContestReview,
  type ContestReviewQualityMark,
  type ContestReviewStatus,
  type ContestSeason,
  type ContestSeasonInput,
} from "@/types/contest";

type ReviewFilter = "all" | ContestReviewStatus;
const CONTEST_REVIEW_QUALITY_OPTIONS: Array<{
  value: ContestReviewQualityMark;
  label: string;
}> = [
  { value: "", label: "Standard" },
  { value: "useful", label: "Critique utile" },
  { value: "excellent", label: "Critique excellente" },
];

const ADMIN_SESSION_EXPIRED_MESSAGE =
  "Session admin expiree. Reconnecte-toi via /admin/login.";

type SeasonFormState = {
  code: string;
  label: string;
  year: string;
  harvestStart: string;
  harvestEnd: string;
  isActive: boolean;
  isArchived: boolean;
};

type EntryFormState = {
  id: string | null;
  slug: string;
  title: string;
  productId: string;
  producerId: string;
  seasonId: string;
  category: ContestEntryInput["category"];
  track: NonNullable<ContestEntryInput["track"]>;
  story: string;
  imageUrl: string;
  galleryInput: string;
  isPublished: boolean;
  position: string;
  variety: string;
  soil: string;
  indoorCultureInput: string;
  harvestDate: string;
  cannabinoidRates: Record<string, string>;
  dominantTerpenesInput: string;
  notes: string;
};

const INDOOR_CULTURE_OPTIONS = [
  "LED",
  "HPS",
  "CMH",
  "Hydroponie",
  "Aeroponie",
  "Coco",
  "Living soil",
  "Terre organique",
  "Greenhouse supplementee",
] as const;

const EMPTY_SEASON_FORM: SeasonFormState = {
  code: "",
  label: "",
  year: String(new Date().getFullYear()),
  harvestStart: "",
  harvestEnd: "",
  isActive: true,
  isArchived: false,
};

function makeEmptyEntryForm(defaultSeasonId = ""): EntryFormState {
  return {
    id: null,
    slug: "",
    title: "",
    productId: "",
    producerId: "",
    seasonId: defaultSeasonId,
    category: "outdoor",
    track: "regular",
    story: "",
    imageUrl: "",
    galleryInput: "",
    isPublished: false,
    position: "0",
    variety: "",
    soil: "",
    indoorCultureInput: "",
    harvestDate: "",
    cannabinoidRates: {},
    dominantTerpenesInput: "",
    notes: "",
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }

  return new Date(parsed).toLocaleString("fr-FR");
}

function parseListInput(value: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const raw of value.split(/[\n,]+/)) {
    const item = raw.trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) {
      continue;
    }
    seen.add(key);
    values.push(item);
  }

  return values;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [
    ...current,
    ...incoming.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    }),
  ];
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  if (response.status === 401 || response.status === 403) {
    return ADMIN_SESSION_EXPIRED_MESSAGE;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (payload?.error) {
      return payload.error;
    }
  } else {
    const text = (await response.text().catch(() => "")).trim();
    if (text) {
      return text;
    }
  }

  return fallback;
}

function validateSeasonForm(form: SeasonFormState): string | null {
  if (form.code.trim().length < 3) {
    return "Renseigne un code saison d'au moins 3 caracteres.";
  }

  if (form.label.trim().length < 3) {
    return "Renseigne un libelle de saison d'au moins 3 caracteres.";
  }

  const year = Number(form.year);
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return "Renseigne une annee valide entre 2020 et 2100.";
  }

  if (form.harvestStart && form.harvestEnd && form.harvestEnd < form.harvestStart) {
    return "La fin de recolte doit etre posterieure au debut.";
  }

  return null;
}

function validateEntryForm(form: EntryFormState): string | null {
  if (form.title.trim().length < 3) {
    return "Renseigne un titre de lot d'au moins 3 caracteres.";
  }

  if (!form.productId.trim()) {
    return "Selectionne d'abord un produit existant et deja sauvegarde.";
  }

  if (!form.seasonId.trim()) {
    return "Selectionne une saison de recolte.";
  }

  return null;
}

function getEntryImagePaths(form: EntryFormState): string[] {
  return parseListInput([form.imageUrl, form.galleryInput].filter(Boolean).join("\n"));
}

function getStringTechnicalValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseCannabinoidRates(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) {
    return {};
  }

  const rates: Record<string, string> = {};
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const row = item as { code?: unknown; rate?: unknown };
    const code = normalizeContestCannabinoid(typeof row.code === "string" ? row.code : "");
    const rate = Number(row.rate);
    if (CANNABIS_CANNABINOID_CODES.has(code) && Number.isFinite(rate)) {
      rates[code] = String(rate);
    }
  }
  return rates;
}

function getCannabinoidRateList(form: EntryFormState): ContestCannabinoidRate[] {
  return Object.entries(form.cannabinoidRates)
    .map(([rawCode, rawRate]) => ({
      code: normalizeContestCannabinoid(rawCode),
      rate: Number(rawRate),
    }))
    .filter(
      (item) =>
        CANNABIS_CANNABINOID_CODES.has(item.code) &&
        Number.isFinite(item.rate) &&
        item.rate >= 0 &&
        item.rate <= 100,
    )
    .map((item) => ({
      code: item.code,
      rate: Number(item.rate.toFixed(3)),
    }));
}

function entryToFormState(entry: ContestEntrySummary): EntryFormState {
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    productId: entry.productId,
    producerId: entry.producerId ?? "",
    seasonId: entry.seasonId,
    category: entry.category,
    track: entry.track,
    story: entry.story,
    imageUrl: entry.imageUrl,
    galleryInput: entry.galleryUrls.join("\n"),
    isPublished: entry.isPublished,
    position: String(entry.position ?? 0),
    variety: getStringTechnicalValue(entry.technicalSheet.variety),
    soil: getStringTechnicalValue(entry.technicalSheet.soil),
    indoorCultureInput: Array.isArray(entry.technicalSheet.indoorCulture)
      ? entry.technicalSheet.indoorCulture.filter((item): item is string => typeof item === "string").join(", ")
      : "",
    harvestDate: getStringTechnicalValue(entry.technicalSheet.harvestDate),
    cannabinoidRates: parseCannabinoidRates(entry.technicalSheet.cannabinoidRates),
    dominantTerpenesInput: Array.isArray(entry.technicalSheet.dominantTerpenes)
      ? entry.technicalSheet.dominantTerpenes.join(", ")
      : "",
    notes: typeof entry.technicalSheet.notes === "string" ? entry.technicalSheet.notes : "",
  };
}

function entryFormToPayload(form: EntryFormState): ContestEntryInput {
  const dominantTerpenes = parseListInput(form.dominantTerpenesInput)
    .map((terpene) => normalizeContestTerpene(terpene))
    .filter((terpene) => CANNABIS_TERPENE_CODES.has(terpene));

  return {
    slug: form.slug.trim() || undefined,
    title: form.title.trim(),
    productId: form.productId,
    producerId: form.producerId.trim() || undefined,
    seasonId: form.seasonId,
    category: form.category,
    track: form.track,
    story: form.story.trim() || undefined,
    technicalSheet: {
      dominantTerpenes,
      variety: form.variety.trim() || undefined,
      soil: form.soil.trim() || undefined,
      indoorCulture: parseListInput(form.indoorCultureInput),
      harvestDate: form.harvestDate || undefined,
      cannabinoidRates: getCannabinoidRateList(form),
      notes: form.notes.trim() || undefined,
    },
    imageUrl: form.imageUrl.trim() || undefined,
    galleryUrls: parseListInput(form.galleryInput),
    isPublished: form.isPublished,
    position: Math.max(0, Math.floor(Number(form.position) || 0)),
  };
}

function getReviewAverage(review: ContestReview): string {
  if (review.scores.length === 0) {
    return "-";
  }

  return `${formatContestAverage(getContestReviewAverage(review.scores))} / ${CONTEST_SCORE_MAX}`;
}

function getSelectedTerpenes(form: EntryFormState): string[] {
  return parseListInput(form.dominantTerpenesInput)
    .map((terpene) => normalizeContestTerpene(terpene))
    .filter((terpene) => CANNABIS_TERPENE_CODES.has(terpene));
}

type AdminContestPanelProps = {
  products: Product[];
  producers: Producer[];
};

type AdminContestPagination = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const ADMIN_CONTEST_LIST_PAGE_SIZE = 200;
const EMPTY_ADMIN_CONTEST_PAGINATION: AdminContestPagination = {
  total: 0,
  limit: ADMIN_CONTEST_LIST_PAGE_SIZE,
  offset: 0,
  hasMore: false,
};

export function AdminContestPanel({ products, producers }: AdminContestPanelProps) {
  const availableProducts = products.slice().sort((a, b) =>
    a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
  );
  const availableProducers = producers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));

  const [seasons, setSeasons] = useState<ContestSeason[]>([]);
  const [entries, setEntries] = useState<ContestEntrySummary[]>([]);
  const [reviews, setReviews] = useState<ContestReview[]>([]);
  const [entriesPagination, setEntriesPagination] = useState<AdminContestPagination>(EMPTY_ADMIN_CONTEST_PAGINATION);
  const [reviewsPagination, setReviewsPagination] = useState<AdminContestPagination>(EMPTY_ADMIN_CONTEST_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [seasonForm, setSeasonForm] = useState<SeasonFormState>(EMPTY_SEASON_FORM);
  const [entryForm, setEntryForm] = useState<EntryFormState>(makeEmptyEntryForm());
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryDeletingId, setEntryDeletingId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
  const [loadingMoreEntries, setLoadingMoreEntries] = useState(false);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [notesByReviewId, setNotesByReviewId] = useState<Record<string, string>>({});
  const [qualityByReviewId, setQualityByReviewId] = useState<Record<string, ContestReviewQualityMark>>({});
  const entryFormRef = useRef<HTMLDivElement | null>(null);

  const loadData = async (
    nextReviewFilter: ReviewFilter = reviewFilter,
    options?: { preserveStatus?: boolean },
  ) => {
    setLoading(true);
    if (!options?.preserveStatus) {
      setStatus(null);
    }

    try {
      const entryQuery = new URLSearchParams({
        limit: String(ADMIN_CONTEST_LIST_PAGE_SIZE),
        offset: "0",
      });
      const reviewQuery = new URLSearchParams({
        limit: String(ADMIN_CONTEST_LIST_PAGE_SIZE),
        offset: "0",
      });
      if (nextReviewFilter !== "all") {
        reviewQuery.set("status", nextReviewFilter);
      }
      const [seasonsResponse, entriesResponse, reviewsResponse] = await Promise.all([
        fetch("/api/admin/contest/seasons", { cache: "no-store" }),
        fetch(`/api/admin/contest/entries?${entryQuery.toString()}`, { cache: "no-store" }),
        fetch(`/api/admin/contest/reviews?${reviewQuery.toString()}`, { cache: "no-store" }),
      ]);

      if (!seasonsResponse.ok) {
        setStatus(await extractErrorMessage(seasonsResponse, "Impossible de charger les saisons."));
        return;
      }
      if (!entriesResponse.ok) {
        setStatus(await extractErrorMessage(entriesResponse, "Impossible de charger les lots."));
        return;
      }
      if (!reviewsResponse.ok) {
        setStatus(await extractErrorMessage(reviewsResponse, "Impossible de charger les avis."));
        return;
      }

      const seasonsPayload = (await seasonsResponse.json()) as {
        seasons?: ContestSeason[];
        error?: string;
      };
      const entriesPayload = (await entriesResponse.json()) as {
        entries?: ContestEntrySummary[];
        pagination?: AdminContestPagination;
        error?: string;
      };
      const reviewsPayload = (await reviewsResponse.json()) as {
        reviews?: ContestReview[];
        pagination?: AdminContestPagination;
        error?: string;
      };

      const nextSeasons = seasonsPayload.seasons ?? [];
      const nextEntries = entriesPayload.entries ?? [];
      const nextReviews = reviewsPayload.reviews ?? [];

      setSeasons(nextSeasons);
      setEntries(nextEntries);
      setReviews(nextReviews);
      setEntriesPagination(entriesPayload.pagination ?? {
        ...EMPTY_ADMIN_CONTEST_PAGINATION,
        total: nextEntries.length,
      });
      setReviewsPagination(reviewsPayload.pagination ?? {
        ...EMPTY_ADMIN_CONTEST_PAGINATION,
        total: nextReviews.length,
      });
      setNotesByReviewId((current) => {
        const next: Record<string, string> = {};
        for (const review of nextReviews) {
          next[review.id] = current[review.id] ?? review.adminNote ?? "";
        }
        return next;
      });
      setQualityByReviewId((current) => {
        const next: Record<string, ContestReviewQualityMark> = {};
        for (const review of nextReviews) {
          next[review.id] = current[review.id] ?? review.qualityMark ?? "";
        }
        return next;
      });

      if (selectedEntryId && !nextEntries.some((entry) => entry.id === selectedEntryId)) {
        setSelectedEntryId(null);
        setEntryForm(makeEmptyEntryForm(nextSeasons.find((season) => season.isActive)?.id ?? nextSeasons[0]?.id ?? ""));
      } else if (!selectedEntryId && !entryForm.seasonId) {
        setEntryForm((current) => ({
          ...current,
          seasonId: nextSeasons.find((season) => season.isActive)?.id ?? nextSeasons[0]?.id ?? "",
        }));
      }
    } catch {
      setStatus("Erreur reseau.");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreEntries = async () => {
    if (!entriesPagination.hasMore || loadingMoreEntries) {
      return;
    }

    setLoadingMoreEntries(true);
    setStatus(null);

    try {
      const entryQuery = new URLSearchParams({
        limit: String(ADMIN_CONTEST_LIST_PAGE_SIZE),
        offset: String(entries.length),
      });
      const response = await fetch(`/api/admin/contest/entries?${entryQuery.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setStatus(await extractErrorMessage(response, "Impossible de charger plus de lots."));
        return;
      }

      const payload = (await response.json()) as {
        entries?: ContestEntrySummary[];
        pagination?: AdminContestPagination;
        error?: string;
      };
      const nextEntries = payload.entries ?? [];
      setEntries((current) => mergeById(current, nextEntries));
      setEntriesPagination(payload.pagination ?? {
        ...entriesPagination,
        hasMore: false,
      });
    } catch {
      setStatus("Erreur reseau pendant le chargement des lots.");
    } finally {
      setLoadingMoreEntries(false);
    }
  };

  const loadMoreReviews = async () => {
    if (!reviewsPagination.hasMore || loadingMoreReviews) {
      return;
    }

    setLoadingMoreReviews(true);
    setStatus(null);

    try {
      const reviewQuery = new URLSearchParams({
        limit: String(ADMIN_CONTEST_LIST_PAGE_SIZE),
        offset: String(reviews.length),
      });
      if (reviewFilter !== "all") {
        reviewQuery.set("status", reviewFilter);
      }

      const response = await fetch(`/api/admin/contest/reviews?${reviewQuery.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setStatus(await extractErrorMessage(response, "Impossible de charger plus d'avis."));
        return;
      }

      const payload = (await response.json()) as {
        reviews?: ContestReview[];
        pagination?: AdminContestPagination;
        error?: string;
      };
      const nextReviews = payload.reviews ?? [];
      setReviews((current) => mergeById(current, nextReviews));
      setNotesByReviewId((current) => {
        const next = { ...current };
        for (const review of nextReviews) {
          next[review.id] = current[review.id] ?? review.adminNote ?? "";
        }
        return next;
      });
      setQualityByReviewId((current) => {
        const next = { ...current };
        for (const review of nextReviews) {
          next[review.id] = current[review.id] ?? review.qualityMark ?? "";
        }
        return next;
      });
      setReviewsPagination(payload.pagination ?? {
        ...reviewsPagination,
        hasMore: false,
      });
    } catch {
      setStatus("Erreur reseau pendant le chargement des avis.");
    } finally {
      setLoadingMoreReviews(false);
    }
  };

  useEffect(() => {
    void loadData(reviewFilter);
    // The panel is self-contained and can reload from the server when the filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewFilter]);

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const selectedProduct = availableProducts.find((product) => product.id === entryForm.productId) ?? null;
  const selectedProducer =
    availableProducers.find((producer) => producer.id === entryForm.producerId) ?? null;
  const entryImages = getEntryImagePaths(entryForm);
  const selectedTerpenes = getSelectedTerpenes(entryForm);

  const resetSeasonForm = () => {
    setSeasonForm(EMPTY_SEASON_FORM);
  };

  const resetEntryForm = () => {
    const defaultSeasonId = seasons.find((season) => season.isActive)?.id ?? seasons[0]?.id ?? "";
    setSelectedEntryId(null);
    setEntryForm(makeEmptyEntryForm(defaultSeasonId));
    setStatus("Formulaire pret pour creer un nouveau lot.");
    window.requestAnimationFrame(() => {
      entryFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSeasonSubmit = async () => {
    const validationError = validateSeasonForm(seasonForm);
    if (validationError) {
      setStatus(validationError);
      return;
    }

    setSeasonSaving(true);
    setStatus(null);

    try {
      const payload: ContestSeasonInput = {
        code: seasonForm.code.trim(),
        label: seasonForm.label.trim(),
        year: Number(seasonForm.year),
        harvestStart: seasonForm.harvestStart || undefined,
        harvestEnd: seasonForm.harvestEnd || undefined,
        isActive: seasonForm.isActive,
        isArchived: seasonForm.isArchived,
      };

      const response = await fetch("/api/admin/contest/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setStatus(await extractErrorMessage(response, "Impossible de creer la saison."));
        return;
      }

      const result = (await response.json()) as { season?: ContestSeason; error?: string };
      if (result.season) {
        setEntryForm((current) => ({
          ...current,
          seasonId: current.seasonId || result.season?.id || "",
        }));
      }
      resetSeasonForm();
      setStatus("Saison creee.");
      await loadData(reviewFilter, { preserveStatus: true });
    } catch {
      setStatus("Erreur reseau pendant la creation de la saison.");
    } finally {
      setSeasonSaving(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = availableProducts.find((item) => item.id === productId) ?? null;
    setEntryForm((current) => ({
      ...current,
      productId,
      title: current.id || current.title.trim() ? current.title : product?.name ?? "",
      producerId: current.id ? current.producerId : product?.producerId ?? "",
      imageUrl: current.id || current.imageUrl.trim() ? current.imageUrl : product?.image ?? "",
      track: current.id ? current.track : product?.category === "fleurs" ? "regular" : "concours",
      category:
        product?.cultureMode && CONTEST_ENTRY_CATEGORIES.includes(product.cultureMode)
          ? product.cultureMode
          : current.category,
    }));
  };

  const handleEntryImagesChange = (nextImagePaths: string[]) => {
    setEntryForm((current) => ({
      ...current,
      imageUrl: nextImagePaths[0] ?? "",
      galleryInput: nextImagePaths.join("\n"),
    }));
  };

  const toggleTerpene = (terpene: string) => {
    setEntryForm((current) => {
      const selected = getSelectedTerpenes(current);
      const next = selected.includes(terpene)
        ? selected.filter((item) => item !== terpene)
        : [...selected, terpene];

      return {
        ...current,
        dominantTerpenesInput: next.join(", "),
      };
    });
  };

  const toggleIndoorCulture = (option: string) => {
    setEntryForm((current) => {
      const selected = parseListInput(current.indoorCultureInput);
      const next = selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];

      return {
        ...current,
        indoorCultureInput: next.join(", "),
      };
    });
  };

  const updateCannabinoidRate = (code: string, rate: string) => {
    setEntryForm((current) => ({
      ...current,
      cannabinoidRates: {
        ...current.cannabinoidRates,
        [code]: rate,
      },
    }));
  };

  const handleEntrySubmit = async () => {
    const validationError = validateEntryForm(entryForm);
    if (validationError) {
      setStatus(validationError);
      return;
    }

    setEntrySaving(true);
    setStatus(null);

    try {
      const payload = entryFormToPayload(entryForm);
      const isEditing = Boolean(entryForm.id);
      const endpoint = isEditing
        ? `/api/admin/contest/entries/${encodeURIComponent(entryForm.id ?? "")}`
        : "/api/admin/contest/entries";
      const response = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setStatus(await extractErrorMessage(response, "Impossible de sauvegarder le lot."));
        return;
      }

      const result = (await response.json()) as { entry?: ContestEntrySummary; error?: string };
      if (!result.entry) {
        setStatus("La reponse serveur est invalide pour ce lot.");
        return;
      }

      setSelectedEntryId(result.entry.id);
      setEntryForm(entryToFormState(result.entry));
      setStatus(isEditing ? "Lot mis a jour." : "Lot cree.");
      await loadData(reviewFilter, { preserveStatus: true });
    } catch {
      setStatus("Erreur reseau pendant la sauvegarde du lot.");
    } finally {
      setEntrySaving(false);
    }
  };

  const handleEntryDelete = async () => {
    const entryId = entryForm.id;
    if (!entryId) {
      return;
    }

    const entryTitle = selectedEntry?.title || entryForm.title || "ce lot";
    const confirmed = window.confirm(
      `Supprimer definitivement le lot "${entryTitle}" ? Les avis, votes et points lies a ce lot seront aussi retires. Cette action est irreversible.`,
    );
    if (!confirmed) {
      return;
    }

    setEntryDeletingId(entryId);
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/contest/entries/${encodeURIComponent(entryId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setStatus(await extractErrorMessage(response, "Impossible de supprimer le lot."));
        return;
      }

      const defaultSeasonId = seasons.find((season) => season.isActive)?.id ?? seasons[0]?.id ?? "";
      setSelectedEntryId(null);
      setEntryForm(makeEmptyEntryForm(defaultSeasonId));
      setStatus("Lot supprime.");
      await loadData(reviewFilter, { preserveStatus: true });
    } catch {
      setStatus("Erreur reseau pendant la suppression du lot.");
    } finally {
      setEntryDeletingId(null);
    }
  };

  const handleReviewModeration = async (
    reviewId: string,
    nextStatus: Exclude<ContestReviewStatus, "pending">,
  ) => {
    setBusyReviewId(reviewId);
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/contest/reviews/${encodeURIComponent(reviewId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          adminNote: notesByReviewId[reviewId] ?? "",
          qualityMark: qualityByReviewId[reviewId] ?? "",
        }),
      });

      if (!response.ok) {
        setStatus(await extractErrorMessage(response, "Impossible de moderer l'avis."));
        return;
      }

      setStatus(nextStatus === "approved" ? "Avis approuve." : "Avis rejete.");
      await loadData(reviewFilter, { preserveStatus: true });
    } catch {
      setStatus("Erreur reseau pendant la moderation.");
    } finally {
      setBusyReviewId(null);
    }
  };

  return (
    <section className="grid gap-6">
      <div className="cartoon-border bg-cream p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl text-ink">Bete de concours</h2>
            <p className="mt-2 text-sm text-charcoal">
              Cree les saisons, rattache des produits existants aux lots premium et modere les avis.
            </p>
          </div>
          <button
            type="button"
            className="btn-cartoon btn-secondary"
            onClick={() => void loadData(reviewFilter)}
          >
            <RefreshCcw size={14} /> Recharger
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.08em] text-charcoal">
          <span className="pill-cartoon px-3 py-1">Saisons: {seasons.length}</span>
          <span className="pill-cartoon px-3 py-1">
            Lots: {entries.length}/{entriesPagination.total}
          </span>
          <span className="pill-cartoon px-3 py-1">
            Publies: {entries.filter((entry) => entry.isPublished).length}
          </span>
          <span className="pill-cartoon px-3 py-1">
            Avis affiches: {reviews.length}/{reviewsPagination.total}
          </span>
        </div>

        {status && <p className="mt-3 text-sm font-semibold text-charcoal">{status}</p>}
        {loading && (
          <p className="mt-3 text-sm text-charcoal">Chargement du tableau de bord concours...</p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="cartoon-border bg-cream p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-2xl text-ink">Saisons</h3>
            <button type="button" className="btn-cartoon btn-secondary" onClick={resetSeasonForm}>
              <Plus size={14} /> Nouvelle
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
              placeholder="Code saison"
              value={seasonForm.code}
              onChange={(event) => setSeasonForm((current) => ({ ...current, code: event.target.value }))}
            />
            <input
              className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
              placeholder="Libelle"
              value={seasonForm.label}
              onChange={(event) => setSeasonForm((current) => ({ ...current, label: event.target.value }))}
            />
            <input
              className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
              type="number"
              min={2020}
              max={2100}
              placeholder="Annee"
              value={seasonForm.year}
              onChange={(event) => setSeasonForm((current) => ({ ...current, year: event.target.value }))}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                type="date"
                value={seasonForm.harvestStart}
                onChange={(event) =>
                  setSeasonForm((current) => ({ ...current, harvestStart: event.target.value }))
                }
              />
              <input
                className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                type="date"
                value={seasonForm.harvestEnd}
                onChange={(event) =>
                  setSeasonForm((current) => ({ ...current, harvestEnd: event.target.value }))
                }
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={seasonForm.isActive}
                onChange={(event) =>
                  setSeasonForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                    isArchived: event.target.checked ? false : current.isArchived,
                  }))
                }
              />
              Saison active
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={seasonForm.isArchived}
                onChange={(event) =>
                  setSeasonForm((current) => ({
                    ...current,
                    isArchived: event.target.checked,
                    isActive: event.target.checked ? false : current.isActive,
                  }))
                }
              />
              Saison archivee
            </label>
            <button
              type="button"
              className="btn-cartoon btn-primary"
              onClick={() => void handleSeasonSubmit()}
              disabled={seasonSaving}
            >
              <Save size={14} /> {seasonSaving ? "Creation..." : "Creer la saison"}
            </button>
          </div>

          <div className="mt-6 grid gap-3">
            {seasons.length === 0 ? (
              <div className="card-cartoon bg-white p-4 text-sm text-charcoal">
                Aucune saison configuree.
              </div>
            ) : (
              seasons.map((season) => (
                <article key={season.id} className="card-cartoon bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{season.label}</p>
                      <p className="text-xs uppercase tracking-[0.08em] text-charcoal">
                        {season.code} - {season.year}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {season.isActive && (
                        <span className="pill-cartoon bg-[#1a1a1a] px-3 py-1 text-xs text-white">
                          Active
                        </span>
                      )}
                      {season.isArchived && (
                        <span className="pill-cartoon px-3 py-1 text-xs">Archivee</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-charcoal">
                    Recolte: {season.harvestStart || "-"} au {season.harvestEnd || "-"}
                  </p>
                  <p className="mt-1 text-xs text-charcoal">
                    Maj: {formatDate(season.updatedAt)}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-6">
          <div className="cartoon-border bg-cream p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl text-ink">Lots premium</h3>
                <p className="mt-2 text-sm text-charcoal">
                  Le produit doit deja exister dans l&apos;onglet <strong>Mes Produits</strong> et etre
                  sauvegarde avant d&apos;etre rattache ici.
                </p>
              </div>
              <button type="button" className="btn-cartoon btn-secondary" onClick={resetEntryForm}>
                <Plus size={14} /> Nouveau lot
              </button>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="grid gap-3">
                {entries.length === 0 ? (
                  <div className="card-cartoon bg-white p-4 text-sm text-charcoal">
                    Aucun lot concours pour le moment.
                  </div>
                ) : (
                  <>
                  {entries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedEntryId(entry.id);
                        setEntryForm(entryToFormState(entry));
                        setStatus(`Modification du lot: ${entry.title}`);
                        window.requestAnimationFrame(() => {
                          entryFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }}
                      className={`rounded border-2 px-4 py-3 text-left transition-colors ${
                        selectedEntryId === entry.id
                          ? "border-[#1a1a1a] bg-[#e8f7f2]"
                          : "border-[#1a1a1a] bg-white hover:bg-[#f7f4ee]"
                      }`}
                    >
                      <p className="font-semibold text-ink">{entry.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-charcoal">
                        {CONTEST_ENTRY_TRACK_LABELS[entry.track]} - {CONTEST_ENTRY_CATEGORY_LABELS[entry.category]} -{" "}
                        {entry.season?.label ?? entry.seasonId}
                      </p>
                      <p className="mt-1 text-xs text-charcoal">
                        Produit: {entry.product?.name ?? entry.productId}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="pill-cartoon px-3 py-1 text-[11px]">
                          {entry.isPublished ? "Publie" : "Brouillon"}
                        </span>
                        <span className="pill-cartoon px-3 py-1 text-[11px]">
                          Note {formatContestAverage(entry.stats.averageScore)} / {CONTEST_SCORE_MAX}
                        </span>
                        <span className="pill-cartoon px-3 py-1 text-[11px]">
                          {entry.stats.approvedReviewCount} avis
                        </span>
                      </div>
                    </button>
                  ))}
                  {entriesPagination.hasMore && (
                    <button
                      type="button"
                      className="btn-cartoon btn-secondary justify-center"
                      onClick={() => void loadMoreEntries()}
                      disabled={loadingMoreEntries}
                    >
                      <RefreshCcw size={14} /> {loadingMoreEntries ? "Chargement..." : "Charger plus de lots"}
                    </button>
                  )}
                  </>
                )}
              </aside>

              <div ref={entryFormRef} className="card-cartoon bg-white p-5">
                <div className="mb-4 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                    {entryForm.id ? "Modification du lot" : "Creation d'un nouveau lot"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {entryForm.id
                      ? entryForm.title || "Lot selectionne"
                      : "Selectionne un produit existant, puis complete les informations concours."}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="h-11 border-2 border-[#1a1a1a] px-3"
                    placeholder="Titre du lot"
                    value={entryForm.title}
                    onChange={(event) => setEntryForm((current) => ({ ...current, title: event.target.value }))}
                  />
                  <input
                    className="h-11 border-2 border-[#1a1a1a] px-3"
                    placeholder="Slug public"
                    value={entryForm.slug}
                    onChange={(event) => setEntryForm((current) => ({ ...current, slug: event.target.value }))}
                  />
                  <select
                    className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                    value={entryForm.productId}
                    onChange={(event) => handleProductSelect(event.target.value)}
                  >
                    <option value="">Selectionner un produit</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.category})
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                    value={entryForm.producerId}
                    onChange={(event) =>
                      setEntryForm((current) => ({ ...current, producerId: event.target.value }))
                    }
                  >
                    <option value="">Producteur du produit</option>
                    {availableProducers.map((producer) => (
                      <option key={producer.id} value={producer.id}>
                        {producer.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                    value={entryForm.seasonId}
                    onChange={(event) => setEntryForm((current) => ({ ...current, seasonId: event.target.value }))}
                  >
                    <option value="">Selectionner une saison</option>
                    {seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                    value={entryForm.track}
                    onChange={(event) =>
                      setEntryForm((current) => ({
                        ...current,
                        track: event.target.value as NonNullable<ContestEntryInput["track"]>,
                      }))
                    }
                  >
                    {CONTEST_ENTRY_TRACKS.map((track) => (
                      <option key={track} value={track}>
                        {CONTEST_ENTRY_TRACK_LABELS[track]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                    value={entryForm.category}
                    onChange={(event) =>
                      setEntryForm((current) => ({
                        ...current,
                        category: event.target.value as ContestEntryInput["category"],
                      }))
                    }
                  >
                    {CONTEST_ENTRY_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {CONTEST_ENTRY_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-11 border-2 border-[#1a1a1a] px-3"
                    type="number"
                    min={0}
                    placeholder="Position"
                    value={entryForm.position}
                    onChange={(event) =>
                      setEntryForm((current) => ({ ...current, position: event.target.value }))
                    }
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={entryForm.isPublished}
                      onChange={(event) =>
                        setEntryForm((current) => ({ ...current, isPublished: event.target.checked }))
                      }
                    />
                    Lot publie sur le site
                  </label>
                  {selectedEntry?.slug && (
                    <a
                      href={`/bete-de-concours/${selectedEntry.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-[#0f5b3f] underline-offset-2 hover:underline"
                    >
                      Ouvrir la fiche publique
                    </a>
                  )}
                </div>

                {(selectedProduct || selectedProducer) && (
                  <div className="mt-4 grid gap-2 rounded border-2 border-dashed border-[#1a1a1a] bg-[#f7f4ee] p-4 text-sm text-charcoal">
                    {selectedProduct && (
                      <p>
                        Produit lie: <strong className="text-ink">{selectedProduct.name}</strong> -{" "}
                        {selectedProduct.price.toFixed(2)} EUR
                      </p>
                    )}
                    {selectedProducer && (
                      <p>
                        Producteur: <strong className="text-ink">{selectedProducer.name}</strong>
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 grid gap-3">
                  <ProductImageUpload images={entryImages} onChange={handleEntryImagesChange} />
                  <div className="grid gap-2 rounded border-2 border-dashed border-[#1a1a1a] bg-[#f7f4ee] p-3 text-xs text-charcoal">
                    <p>
                      La premiere image devient automatiquement l&apos;image principale de la fiche concours.
                    </p>
                    {entryForm.imageUrl ? (
                      <p className="break-all">
                        Image principale: <span className="font-mono">{entryForm.imageUrl}</span>
                      </p>
                    ) : (
                      <p>Aucune image uploadee pour ce lot.</p>
                    )}
                  </div>
                </div>

                <textarea
                  className="mt-4 min-h-28 w-full border-2 border-[#1a1a1a] p-3 text-sm"
                  placeholder="Histoire du lot, parti pris producteur, pourquoi c'est une bete de concours..."
                  value={entryForm.story}
                  onChange={(event) => setEntryForm((current) => ({ ...current, story: event.target.value }))}
                />

                <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                        Fiche technique carnet
                      </p>
                      <p className="mt-1 text-sm text-charcoal">
                        Ces donnees apparaissent dans le guide de degustation client.
                      </p>
                    </div>
                    <span className="rounded-full border-2 border-[#1a1a1a] bg-white px-3 py-1 text-xs font-black text-ink">
                      {getCannabinoidRateList(entryForm).length} cannabinoides
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                      placeholder="Variete"
                      value={entryForm.variety}
                      onChange={(event) => setEntryForm((current) => ({ ...current, variety: event.target.value }))}
                    />
                    <input
                      className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                      placeholder="Sol / substrat"
                      value={entryForm.soil}
                      onChange={(event) => setEntryForm((current) => ({ ...current, soil: event.target.value }))}
                    />
                    <label className="grid gap-1 text-sm font-semibold text-ink">
                      Date de recolte
                      <input
                        className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
                        type="date"
                        value={entryForm.harvestDate}
                        onChange={(event) => setEntryForm((current) => ({ ...current, harvestDate: event.target.value }))}
                      />
                    </label>
                  </div>

                  {entryForm.category === "indoor" ? (
                    <div className="mt-4 rounded border-2 border-dashed border-[#1a1a1a] bg-white p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                        Options culture indoor
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {INDOOR_CULTURE_OPTIONS.map((option) => {
                          const checked = parseListInput(entryForm.indoorCultureInput).includes(option);
                          return (
                            <label
                              key={option}
                              className={`flex min-h-11 items-start gap-2 rounded border-2 px-3 py-2 text-sm font-semibold ${
                                checked
                                  ? "border-[#1a1a1a] bg-yellow text-ink"
                                  : "border-[#1a1a1a] bg-[#f7f4ee] text-charcoal"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleIndoorCulture(option)}
                                className="mt-0.5 h-4 w-4 accent-[#d35400]"
                              />
                              <span className="leading-tight">{option}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded border-2 border-dashed border-[#1a1a1a] bg-white p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                      Taux de cannabinoides
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {CANNABIS_CANNABINOID_OPTIONS.map((cannabinoid) => (
                        <label key={cannabinoid.code} className="grid gap-1 text-sm font-semibold text-ink">
                          <span>{cannabinoid.label}</span>
                          <input
                            className="h-11 border-2 border-[#1a1a1a] bg-[#fffaf0] px-3"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            placeholder="%"
                            value={entryForm.cannabinoidRates[cannabinoid.code] ?? ""}
                            onChange={(event) => updateCannabinoidRate(cannabinoid.code, event.target.value)}
                          />
                          <span className="text-xs font-normal leading-relaxed text-charcoal">
                            {cannabinoid.description}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#fffaf0] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                        Terpenes presents
                      </p>
                      <p className="mt-1 text-sm text-charcoal">
                        Coche les terpenes detectes ou annonces pour cette fleur.
                      </p>
                    </div>
                    <span className="rounded-full border-2 border-[#1a1a1a] bg-white px-3 py-1 text-xs font-black text-ink">
                      {selectedTerpenes.length} selectionnes
                    </span>
                  </div>

                  <div className="mt-4 grid max-h-[360px] gap-2 overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-3">
                    {CANNABIS_TERPENE_OPTIONS.map((terpene) => {
                      const checked = selectedTerpenes.includes(terpene.code);
                      return (
                        <label
                          key={terpene.code}
                          className={`flex min-h-11 items-start gap-2 rounded border-2 px-3 py-2 text-sm font-semibold ${
                            checked
                              ? "border-[#1a1a1a] bg-yellow text-ink"
                              : "border-[#1a1a1a] bg-white text-charcoal"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTerpene(terpene.code)}
                            className="mt-0.5 h-4 w-4 accent-[#d35400]"
                          />
                          <span className="leading-tight">{terpene.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  className="mt-4 min-h-20 w-full border-2 border-[#1a1a1a] p-3 text-sm"
                  placeholder="Notes techniques complementaires"
                  value={entryForm.notes}
                  onChange={(event) => setEntryForm((current) => ({ ...current, notes: event.target.value }))}
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn-cartoon btn-primary"
                    onClick={() => void handleEntrySubmit()}
                    disabled={entrySaving || Boolean(entryDeletingId)}
                  >
                    <Save size={14} /> {entrySaving ? "Sauvegarde..." : entryForm.id ? "Mettre a jour" : "Creer le lot"}
                  </button>
                  {entryForm.id && (
                    <button
                      type="button"
                      className="btn-cartoon btn-primary"
                      onClick={() => void handleEntryDelete()}
                      disabled={entrySaving || Boolean(entryDeletingId)}
                    >
                      <Trash2 size={14} /> {entryDeletingId === entryForm.id ? "Suppression..." : "Supprimer"}
                    </button>
                  )}
                  <button type="button" className="btn-cartoon btn-secondary" onClick={resetEntryForm}>
                    Reinitialiser
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="cartoon-border bg-cream p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl text-ink">Moderation des avis</h3>
                <p className="mt-2 text-sm text-charcoal">
                  Les avis approuves deviennent visibles sur la fiche publique et alimentent le classement.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["all", "pending", "approved", "rejected"] as ReviewFilter[]).map((filterValue) => (
                <button
                  key={filterValue}
                  type="button"
                  onClick={() => setReviewFilter(filterValue)}
                  className={`pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.09em] ${
                    reviewFilter === filterValue ? "bg-[#1a1a1a] text-white" : "bg-white text-ink"
                  }`}
                >
                  {filterValue === "all" ? "Tous" : CONTEST_REVIEW_STATUS_LABELS[filterValue]}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4">
              {reviews.length === 0 ? (
                <div className="card-cartoon bg-white p-4 text-sm text-charcoal">
                  Aucun avis pour ce filtre.
                </div>
              ) : (
                <>
                {reviews.map((review) => (
                  <article key={review.id} className="card-cartoon bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">
                          {review.pseudo} - {review.entryTitle ?? review.entryId}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.08em] text-charcoal">
                          {review.category ? CONTEST_ENTRY_CATEGORY_LABELS[review.category] : "Categorie inconnue"} -{" "}
                          {CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod]}
                        </p>
                        <p className="mt-1 text-xs text-charcoal">
                          Cree le {formatDate(review.createdAt)} - moyenne {getReviewAverage(review)}
                        </p>
                      </div>
                      <span className="pill-cartoon px-3 py-1 text-xs uppercase tracking-[0.09em]">
                        {CONTEST_REVIEW_STATUS_LABELS[review.status]}
                      </span>
                    </div>

                    {review.comment && <p className="mt-3 text-sm text-charcoal">{review.comment}</p>}

                    {review.aromaTags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {review.aromaTags.map((aroma) => (
                          <span key={`${review.id}-${aroma.tag}-${aroma.customLabel ?? ""}`} className="pill-cartoon px-3 py-1 text-[11px]">
                            {aroma.customLabel?.trim() || aroma.tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <textarea
                      className="mt-4 min-h-20 w-full border-2 border-[#1a1a1a] p-3 text-sm"
                      placeholder="Note admin visible seulement en moderation"
                      value={notesByReviewId[review.id] ?? ""}
                      onChange={(event) =>
                        setNotesByReviewId((current) => ({
                          ...current,
                          [review.id]: event.target.value,
                        }))
                      }
                    />

                    <label className="mt-3 block text-xs font-bold uppercase tracking-[0.08em] text-charcoal">
                      Qualite de la critique
                      <select
                        className="mt-1 w-full border-2 border-[#1a1a1a] bg-white p-2 text-sm normal-case tracking-normal text-ink"
                        value={qualityByReviewId[review.id] ?? ""}
                        onChange={(event) =>
                          setQualityByReviewId((current) => ({
                            ...current,
                            [review.id]: event.target.value as ContestReviewQualityMark,
                          }))
                        }
                      >
                        {CONTEST_REVIEW_QUALITY_OPTIONS.map((option) => (
                          <option key={option.value || "standard"} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-cartoon btn-secondary inline-flex items-center gap-2"
                        disabled={busyReviewId === review.id}
                        onClick={() => void handleReviewModeration(review.id, "approved")}
                      >
                        <Check size={14} /> Approuver
                      </button>
                      <button
                        type="button"
                        className="btn-cartoon btn-primary inline-flex items-center gap-2"
                        disabled={busyReviewId === review.id}
                        onClick={() => void handleReviewModeration(review.id, "rejected")}
                      >
                        <X size={14} /> Rejeter
                      </button>
                    </div>
                  </article>
                ))}
                {reviewsPagination.hasMore && (
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary justify-center"
                    onClick={() => void loadMoreReviews()}
                    disabled={loadingMoreReviews}
                  >
                    <RefreshCcw size={14} /> {loadingMoreReviews ? "Chargement..." : "Charger plus d'avis"}
                  </button>
                )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
