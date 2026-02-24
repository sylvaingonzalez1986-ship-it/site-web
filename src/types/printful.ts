export type PrintfulSyncStatus = "idle" | "running" | "success" | "error";

export type PrintfulSyncState = {
  lastSyncAt?: string;
  lastSyncStatus: PrintfulSyncStatus;
  lastSyncMessage?: string;
  updatedAt?: string;
};

export type PrintfulSyncSummary = {
  productsCount: number;
  variantsCount: number;
  syncedAt: string;
};

export type PrintfulSyncedVariant = {
  syncVariantId: number;
  syncProductId: number;
  variantName: string;
  sku?: string;
  retailPrice: number;
  currency: string;
  imageUrl: string;
  isEnabled: boolean;
  isInStock: boolean;
  updatedAt: string;
};

export type PrintfulSyncedProduct = {
  syncProductId: number;
  productName: string;
  thumbnailUrl: string;
  variants: PrintfulSyncedVariant[];
  isPublished: boolean;
  updatedAt: string;
};

export type PrintfulAdminSnapshot = {
  tokenConfigured: boolean;
  storeIdConfigured: boolean;
  state: PrintfulSyncState;
  products: PrintfulSyncedProduct[];
};


