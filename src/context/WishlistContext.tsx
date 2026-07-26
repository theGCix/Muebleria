// src/context/WishlistContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
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

// ── Favoritos de invitado (sin sesión), guardados localmente ──
const GUEST_KEY = "gm_wishlist_guest";

function getGuestIds(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setGuestIds(ids: string[]) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(ids));
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const mergedRef = useRef(false);

  const fetchWishlistDB = useCallback(async () => {
    if (!user) return;
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

  const fetchWishlistGuest = useCallback(async () => {
    const ids = getGuestIds();
    if (ids.length === 0) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").in("id", ids);
    if (!error && data) {
      setItems(
        ids
          .map((id) => {
            const product = data.find((p: any) => p.id === id);
            return product
              ? { id, product_id: id, product: product as Product, created_at: new Date().toISOString() }
              : null;
          })
          .filter(Boolean) as WishlistItem[]
      );
    }
    setLoading(false);
  }, []);

  // Al iniciar sesión: fusionar favoritos de invitado con los de la cuenta (una sola vez por sesión)
  useEffect(() => {
    if (!user) {
      mergedRef.current = false;
      fetchWishlistGuest();
      return;
    }
    if (mergedRef.current) {
      fetchWishlistDB();
      return;
    }
    mergedRef.current = true;
    (async () => {
      const guestIds = getGuestIds();
      if (guestIds.length > 0) {
        const { data: existing } = await supabase
          .from("wishlist")
          .select("product_id")
          .eq("user_id", user.id);
        const existingIds = new Set((existing ?? []).map((r: any) => r.product_id));
        const toInsert = guestIds.filter((id) => !existingIds.has(id));
        if (toInsert.length > 0) {
          await supabase
            .from("wishlist")
            .insert(toInsert.map((product_id) => ({ user_id: user.id, product_id })));
        }
        localStorage.removeItem(GUEST_KEY);
      }
      await fetchWishlistDB();
    })();
  }, [user, fetchWishlistDB, fetchWishlistGuest]);

  const addToWishlist = useCallback(async (productId: string) => {
    if (!user) {
      const ids = getGuestIds();
      if (!ids.includes(productId)) setGuestIds([...ids, productId]);
      await fetchWishlistGuest();
      return true;
    }
    const { error } = await supabase
      .from("wishlist")
      .insert({ user_id: user.id, product_id: productId });
    if (!error) await fetchWishlistDB();
    return !error;
  }, [user, fetchWishlistDB, fetchWishlistGuest]);

  const removeFromWishlist = useCallback(async (productId: string) => {
    if (!user) {
      setGuestIds(getGuestIds().filter((id) => id !== productId));
      setItems((prev) => prev.filter((i) => i.product_id !== productId));
      return;
    }
    await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
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

  const refetch = user ? fetchWishlistDB : fetchWishlistGuest;

  return (
    <WishlistContext.Provider value={{ items, loading, toggleWishlist, removeFromWishlist, isWishlisted, refetch }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist debe usarse dentro de <WishlistProvider>");
  return ctx;
}