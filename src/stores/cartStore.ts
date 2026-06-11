import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackEvent } from "@/hooks/useEventTracking";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image?: string;
  sku?: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        set((state) => {

          // Primer producto agregado al carrito
          if (state.items.length === 0) {
            trackEvent({
              tipo: "carrito_iniciado",
              valor: item.price,
            });
          }

          const existing = state.items.find((i) => i.id === item.id);

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, qty: i.qty + 1 } : i
              ),
            };
          }

          return {
            items: [...state.items, { ...item, qty: 1 }],
          };
        });
      },
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQty: (id, qty) => {
        if (qty <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, qty } : i)),
        }));
      },
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
    }),
    { name: "gm-cart" }
  )
);
