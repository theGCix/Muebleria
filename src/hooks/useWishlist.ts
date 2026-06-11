// src/hooks/useWishlist.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/hooks/useProducts";

export interface WishlistItem {
  id: string;          // wishlist row id
  product_id: string;
  product: Product;
  created_at: string;
}

export function useWishlist() {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Carga los favoritos del usuario desde Supabase
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

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Agrega un producto a favoritos
  const addToWishlist = useCallback(async (productId: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from("wishlist")
      .insert({ user_id: user.id, product_id: productId });
    if (!error) await fetchWishlist();
    return !error;
  }, [user, fetchWishlist]);

  // Elimina un producto de favoritos
  const removeFromWishlist = useCallback(async (productId: string) => {
    if (!user) return;
    await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, [user]);

  // Toggle: si ya está, lo quita; si no, lo agrega
  const toggleWishlist = useCallback(async (productId: string): Promise<boolean> => {
    const exists = items.some((i) => i.product_id === productId);
    if (exists) {
      await removeFromWishlist(productId);
      return false;
    } else {
      await addToWishlist(productId);
      return true;
    }
  }, [items, addToWishlist, removeFromWishlist]);

  const isWishlisted = useCallback(
    (productId: string) => items.some((i) => i.product_id === productId),
    [items]
  );

  return { items, loading, toggleWishlist, removeFromWishlist, isWishlisted, refetch: fetchWishlist };
}