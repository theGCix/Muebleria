// src/context/WishlistContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/hooks/useProducts";

export interface WishlistItem {
  id: string;
  product_id: string;
  product: Product;
  created_at: string;
}

interface WishlistContextValue {
  items: WishlistItem[];
  loading: boolean;
  toggleWishlist: (productId: string) => Promise<boolean>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  refetch: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("wishlist")
      .select("id, product_id, created_at, products(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setItems(
        data.map((row: any) => ({
          id: row.id,
          product_id: row.product_id,
          product: row.products as Product,
          created_at: row.created_at,
        }))
      );
    }
    setLoading(false);
  }, [user]);

  // Re-fetch cuando cambia el usuario
  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  const addToWishlist = useCallback(async (productId: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from("wishlist")
      .insert({ user_id: user.id, product_id: productId });
    if (!error) await fetchWishlist();
    return !error;
  }, [user, fetchWishlist]);

  const removeFromWishlist = useCallback(async (productId: string) => {
    if (!user) return;
    await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    // Actualización optimista local
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, [user]);

  const toggleWishlist = useCallback(async (productId: string): Promise<boolean> => {
    const exists = items.some((i) => i.product_id === productId);
    if (exists) {
      await removeFromWishlist(productId);
      return false;
    } else {
      return await addToWishlist(productId) ?? false;
    }
  }, [items, addToWishlist, removeFromWishlist]);

  const isWishlisted = useCallback(
    (productId: string) => items.some((i) => i.product_id === productId),
    [items]
  );

  return (
    <WishlistContext.Provider value={{ items, loading, toggleWishlist, removeFromWishlist, isWishlisted, refetch: fetchWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist debe usarse dentro de <WishlistProvider>");
  return ctx;
}