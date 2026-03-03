"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Product } from "@/data/products";
import { getAvailableQuantity, getSelectableVariantOptions } from "@/lib/product-stock";
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
  addToCart: (product: Product, variantId?: string, quantity?: number) => CartActionResult;
  removeFromCart: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => CartActionResult;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/account/me", { cache: "no-store" });
        if (!response.ok) {
          if (mounted) {
            setIsAuthenticated(false);
          }
          return;
        }

        const data = (await response.json()) as { user: PublicCustomer | null };
        if (mounted) {
          setIsAuthenticated(Boolean(data.user));
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

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
    isAuthenticated,
    authLoading,
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
