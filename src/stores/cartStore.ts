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
  // Presentes solo cuando el item entró al carrito como parte de un combo —
  // el id sigue siendo el product_id real (checkout no cambia), esto es
  // únicamente para agrupar visualmente en el carrito.
  comboId?: string;
  comboLabel?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">) => void;
  addItems: (items: (Omit<CartItem, "qty"> & { qty?: number })[]) => void;
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
      addItems: (newItems) => {
        set((state) => {
          let items = [...state.items];
          for (const item of newItems) {
            const addQty = item.qty ?? 1;
            const existing = items.find((i) => i.id === item.id);
            if (existing) {
              items = items.map((i) =>
                i.id === item.id ? { ...i, qty: i.qty + addQty } : i
              );
            } else {
              items = [...items, { ...item, qty: addQty }];
            }
          }
          return { items };
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