"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/data/products";
import { getSelectableVariantOptions } from "@/lib/product-stock";
import type { PublicCustomer } from "@/types/customer";

type CartLine = Product & {
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  totalItems: number;
  totalPrice: number;
  isAuthenticated: boolean;
  authLoading: boolean;
  addToCart: (product: Product, variantId?: string, quantity?: number) => boolean;
  removeFromCart: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
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

  const addToCart = (product: Product, variantId?: string, quantity: number = 1): boolean => {
    if (!isAuthenticated) {
      return false;
    }

    const qty = Math.max(1, Math.round(quantity));

    const [baseProductId, embeddedVariantId = ""] = product.id.split("::", 2);
    const variantKey = variantId || embeddedVariantId;
    const selectableVariants = Array.isArray(product.variantOptions)
      ? getSelectableVariantOptions(product)
      : [];
    const variant = variantKey
      ? selectableVariants.find((option) => option.id === variantKey)
      : selectableVariants[0];
    const normalizedBaseId = baseProductId || product.id;
    const cartProductId = variant ? `${normalizedBaseId}::${variant.id}` : normalizedBaseId;
    const cartProductName = variant
      ? embeddedVariantId
        ? product.name
        : `${product.name} - ${variant.label}`
      : product.name;
    const cartProductPrice = variant ? variant.price : product.price;

    if (!Number.isFinite(cartProductPrice) || cartProductPrice < 0) {
      return false;
    }

    setItems((current) => {
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

    return true;
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

  const setQuantity = (productId: string, quantity: number) => {
    const qty = Math.max(1, Math.round(quantity));
    setItems((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, quantity: qty } : item,
      ),
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const value = useMemo(
    () => ({
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
    }),
    [authLoading, isAuthenticated, items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }

  return ctx;
}
