"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Product } from "@/data/products";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import { getAvailableQuantity, getSelectableVariantOptions } from "@/lib/product-stock";
import type { LoyaltySummary } from "@/types/loyalty";
import type { LotteryConfig, LotteryInventory, LotteryTicket } from "@/types/lottery";
import type { CmsOrder } from "@/types/store";
import type { PublicCustomer } from "@/types/customer";

type CartLine = Product & {
  quantity: number;
};

export type CartActionResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "invalid_product" | "stock_limit"; maxAvailable?: number };

type CartContextValue = {
  items: CartLine[];
  totalItems: number;
  totalPrice: number;
  isAuthenticated: boolean;
  authLoading: boolean;
  sessionLoading: boolean;
  user: PublicCustomer | null;
  orders: CmsOrder[];
  loyalty: LoyaltySummary;
  tickets: LotteryTicket[];
  lotteryInventory: LotteryInventory | null;
  lotteryConfig: LotteryConfig | null;
  availableTicketCount: number;
  hasWelcomePack: boolean;
  refreshSession: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;
  setUser: (user: PublicCustomer | null) => void;
  setOrders: (orders: CmsOrder[]) => void;
  addToCart: (product: Product, variantId?: string, quantity?: number) => CartActionResult;
  removeFromCart: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => CartActionResult;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const REFRESH_COOLDOWN_MS = 30_000;
  const lastRefreshAtRef = useRef(0);
  const [items, setItems] = useState<CartLine[]>([]);
  const [user, setUser] = useState<PublicCustomer | null>(null);
  const [orders, setOrders] = useState<CmsOrder[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(buildEmptyLoyaltySummary());
  const [tickets, setTickets] = useState<LotteryTicket[]>([]);
  const [lotteryInventory, setLotteryInventory] = useState<LotteryInventory | null>(null);
  const [lotteryConfig, setLotteryConfig] = useState<LotteryConfig | null>(null);
  const [hasWelcomePack, setHasWelcomePack] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const isAuthenticated = Boolean(user);

  const scheduleIdleRefresh = useCallback((task: () => void) => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleId = idleWindow.requestIdleCallback(task, { timeout: 1200 });
      return () => {
        if (typeof idleWindow.cancelIdleCallback === "function") {
          idleWindow.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(task, 220);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const refreshSession = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    const silent = options?.silent === true;
    const force = options?.force === true;
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < REFRESH_COOLDOWN_MS) {
      return;
    }
    lastRefreshAtRef.current = now;

    if (!silent) {
      setAuthLoading(true);
    }

    try {
      const meResponse = await fetch("/api/account/me", { cache: "no-store" });
      if (!meResponse.ok) {
        setUser(null);
        setOrders([]);
        setLoyalty(buildEmptyLoyaltySummary());
        setTickets([]);
        setLotteryInventory(null);
        setLotteryConfig(null);
        setHasWelcomePack(false);
        return;
      }

      const meData = (await meResponse.json()) as { user: PublicCustomer | null };
      const nextUser = meData.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setOrders([]);
        setLoyalty(buildEmptyLoyaltySummary());
        setTickets([]);
        setLotteryInventory(null);
        setLotteryConfig(null);
        setHasWelcomePack(false);
        return;
      }

      const [ordersResponse, ticketsResponse, welcomePackResponse] = await Promise.all([
        fetch("/api/account/orders", { cache: "no-store" }),
        fetch("/api/account/tickets", { cache: "no-store" }),
        fetch("/api/account/welcome-pack", { cache: "no-store" }),
      ]);

      if (ordersResponse.ok) {
        const ordersData = (await ordersResponse.json()) as {
          orders?: CmsOrder[];
          loyalty?: LoyaltySummary;
        };
        setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
        setLoyalty(ordersData.loyalty ?? buildEmptyLoyaltySummary());
      } else {
        setOrders([]);
        setLoyalty(buildEmptyLoyaltySummary());
      }

      if (ticketsResponse.ok) {
        const ticketsData = (await ticketsResponse.json()) as {
          tickets?: LotteryTicket[];
          inventory?: LotteryInventory | null;
          config?: LotteryConfig | null;
        };
        setTickets(ticketsData.tickets ?? []);
        setLotteryInventory(ticketsData.inventory ?? null);
        setLotteryConfig(ticketsData.config ?? null);
      } else {
        setTickets([]);
        setLotteryInventory(null);
        setLotteryConfig(null);
      }

      if (welcomePackResponse.ok) {
        const welcomePackData = (await welcomePackResponse.json()) as { eligible?: boolean };
        setHasWelcomePack(Boolean(welcomePackData.eligible));
      } else {
        setHasWelcomePack(false);
      }
    } finally {
      if (!silent) {
        setAuthLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const cancel = scheduleIdleRefresh(() => {
      void refreshSession({ force: true });
    });
    return cancel;
  }, [refreshSession, scheduleIdleRefresh]);

  useEffect(() => {
    const cancel = scheduleIdleRefresh(() => {
      void refreshSession({ silent: true });
    });
    return cancel;
  }, [pathname, refreshSession, scheduleIdleRefresh]);

  useEffect(() => {
    const onFocus = () => {
      void refreshSession({ silent: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSession({ silent: true });
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshSession]);

  const addToCart = (product: Product, variantId?: string, quantity: number = 1): CartActionResult => {
    if (!isAuthenticated) {
      return { ok: false, reason: "unauthenticated" };
    }

    const qty = Math.max(1, Math.round(quantity));
    let result: CartActionResult = { ok: true };

    setItems((current) => {
      const [baseProductId, embeddedVariantId = ""] = product.id.split("::", 2);
      const variantKey = variantId || embeddedVariantId;
      const allVariants = Array.isArray(product.variantOptions) ? product.variantOptions : [];
      const selectableVariants = Array.isArray(product.variantOptions)
        ? getSelectableVariantOptions(product)
        : [];
      const variant = variantKey
        ? allVariants.find((option) => option.id === variantKey)
        : selectableVariants[0];
      const normalizedBaseId = baseProductId || product.id;
      const cartProductId = variant ? `${normalizedBaseId}::${variant.id}` : normalizedBaseId;
      const cartProductName = variant
        ? embeddedVariantId
          ? product.name
          : `${product.name} - ${variant.label}`
        : product.name;
      const cartProductPrice = variant ? variant.price : product.price;

      if (variantKey && !variant) {
        result = { ok: false, reason: "invalid_product" };
        return current;
      }

      if (!Number.isFinite(cartProductPrice) || cartProductPrice < 0) {
        result = { ok: false, reason: "invalid_product" };
        return current;
      }

      const existingQuantity = current.find((item) => item.id === cartProductId)?.quantity ?? 0;
      const availableQuantity = getAvailableQuantity(product, variantKey);
      if (availableQuantity !== null && existingQuantity + qty > availableQuantity) {
        result = {
          ok: false,
          reason: "stock_limit",
          maxAvailable: availableQuantity,
        };
        return current;
      }

      const existing = current.find((item) => item.id === cartProductId);
      if (!existing) {
        return [
          ...current,
          {
            ...product,
            id: cartProductId,
            name: cartProductName,
            price: cartProductPrice,
            quantity: qty,
          },
        ];
      }

      return current.map((item) =>
        item.id === cartProductId ? { ...item, quantity: item.quantity + qty } : item,
      );
    });

    return result;
  };

  const removeFromCart = (productId: string) => {
    setItems((current) => current.filter((item) => item.id !== productId));
  };

  const decreaseQuantity = (productId: string) => {
    setItems((current) =>
      current.flatMap((item) => {
        if (item.id !== productId) {
          return item;
        }

        if (item.quantity === 1) {
          return [];
        }

        return { ...item, quantity: item.quantity - 1 };
      }),
    );
  };

  const setQuantity = (productId: string, quantity: number): CartActionResult => {
    const qty = Math.max(1, Math.round(quantity));
    let result: CartActionResult = { ok: true };

    setItems((current) => {
      const targetItem = current.find((item) => item.id === productId);
      if (!targetItem) {
        result = { ok: false, reason: "invalid_product" };
        return current;
      }

      const [, embeddedVariantId = ""] = targetItem.id.split("::", 2);
      const availableQuantity = getAvailableQuantity(targetItem, embeddedVariantId);
      const nextQuantity =
        availableQuantity !== null ? Math.min(qty, availableQuantity) : qty;

      if (availableQuantity !== null && qty > availableQuantity) {
        result = {
          ok: false,
          reason: "stock_limit",
          maxAvailable: availableQuantity,
        };
      }

      if (nextQuantity <= 0) {
        return current.filter((item) => item.id !== productId);
      }

      return current.map((item) =>
        item.id === productId ? { ...item, quantity: nextQuantity } : item,
      );
    });

    return result;
  };

  const clearCart = () => {
    setItems([]);
  };

  const value: CartContextValue = {
    items,
    user,
    orders,
    loyalty,
    tickets,
    lotteryInventory,
    lotteryConfig,
    hasWelcomePack,
    isAuthenticated,
    authLoading,
    sessionLoading: authLoading,
    availableTicketCount: tickets.filter((ticket) => ticket.status === "available").length,
    refreshSession,
    setUser,
    setOrders,
    totalItems: items.reduce((acc, item) => acc + item.quantity, 0),
    totalPrice: items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    addToCart,
    removeFromCart,
    decreaseQuantity,
    setQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }

  return ctx;
}
