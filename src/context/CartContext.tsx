"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { Product } from "@/data/products";
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
  addToCart: (product: Product) => boolean;
  removeFromCart: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
  }, [pathname]);

  const addToCart = (product: Product): boolean => {
    if (!isAuthenticated) {
      return false;
    }

    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (!existing) {
        return [...current, { ...product, quantity: 1 }];
      }

      return current.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
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
