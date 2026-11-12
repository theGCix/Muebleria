import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackAddToCart } from "@/lib/analytics";
import { trackEvent } from "@/hooks/useEventTracking";
import { esRutaStaff } from "@/lib/rutas";

/**
 * Registra `carrito_iniciado` en eventos_web (la métrica de carritos): una vez por sesión, en la
 * primera pieza que entra al carrito. Va con solo_bd porque add_to_cart de GA4/Meta ya sale de
 * trackAddToCart; así no se duplica. No se registra en el panel interno del negocio (POS, etc.).
 */
function registrarCarritoIniciado(productId: string, valor: number) {
  try {
    if (typeof window === "undefined" || esRutaStaff(window.location.pathname)) return;
    if (sessionStorage.getItem("gm_carrito_iniciado")) return;
    sessionStorage.setItem("gm_carrito_iniciado", "1");
  } catch {
    return;
  }
  void trackEvent({ tipo: "carrito_iniciado", product_id: productId, valor, solo_bd: true });
}

export interface CartItem {
  /**
   * Identifica la LÍNEA del carrito: id de producto + ids de las opciones elegidas (ordenados).
   * Sin opciones es igual al id del producto, así dos acabados distintos del mismo mueble son dos líneas.
   */
  lineId: string;
  /** product_id real (el checkout y el servidor siguen usando este). */
  id: string;
  title: string;
  /** Precio unitario ya con opciones y oferta (el servidor lo recalcula al cobrar). */
  price: number;
  image?: string;
  sku?: string;
  qty: number;
  /**
   * Ids de los valores de opciones elegidos (producto_opcion_valores). `undefined` = formato antiguo
   * (producto sin opciones en BD): el servidor lo trata como hasta ahora.
   */
  opciones?: string[];
  // Presentes solo cuando el item entró al carrito como parte de un combo —
  // el id sigue siendo el product_id real (checkout no cambia), esto es
  // únicamente para agrupar visualmente en el carrito.
  comboId?: string;
  comboLabel?: string;
}

/** Entrada de addItem/addItems: lineId se calcula solo (los llamadores antiguos no cambian). */
export type NuevoItem = Omit<CartItem, "qty" | "lineId"> & { lineId?: string };

/** lineId = product_id, o product_id::idValor1+idValor2 (ids ordenados) cuando hay opciones. */
export const calcLineId = (id: string, opciones?: string[] | null): string =>
  opciones && opciones.length ? `${id}::${[...opciones].sort().join("+")}` : id;

interface CartState {
  items: CartItem[];
  addItem: (item: NuevoItem) => void;
  addItems: (items: (NuevoItem & { qty?: number })[]) => void;
  /** Quita una línea. Para productos sin opciones lineId == product_id. */
  removeItem: (lineId: string) => void;
  /** Quita del carrito todas las piezas que entraron con ese combo. */
  removeCombo: (comboId: string) => void;
  updateQty: (lineId: string, qty: number) => void;
  /** Sustituye el precio unitario de cada línea por el que calculó el servidor ({ [lineId]: precio }). */
  actualizarPrecios: (precios: Record<string, number>) => void;
  clearCart: () => void;
  total: () => number;
}

const conLineId = <T extends NuevoItem>(item: T): T & { lineId: string } => ({
  ...item,
  lineId: item.lineId ?? calcLineId(item.id, item.opciones),
});

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (raw) => {
        const item = conLineId(raw);
        trackAddToCart({ id: item.id, nombre: item.title, precio: item.price });
        registrarCarritoIniciado(item.id, item.price);
        set((state) => {
          const existing = state.items.find((i) => i.lineId === item.lineId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === item.lineId ? { ...i, qty: i.qty + 1 } : i
              ),
            };
          }
          return {
            items: [...state.items, { ...item, qty: 1 }],
          };
        });
      },
      addItems: (newItems) => {
        for (const it of newItems) {
          trackAddToCart({ id: it.id, nombre: it.title, precio: it.price, cantidad: it.qty ?? 1 });
        }
        if (newItems.length > 0) {
          registrarCarritoIniciado(newItems[0].id, newItems.reduce((s, it) => s + it.price * (it.qty ?? 1), 0));
        }
        set((state) => {
          let items = [...state.items];
          for (const raw of newItems) {
            const item = conLineId(raw);
            const addQty = item.qty ?? 1;
            const existing = items.find((i) => i.lineId === item.lineId);
            if (existing) {
              items = items.map((i) =>
                i.lineId === item.lineId ? { ...i, qty: i.qty + addQty } : i
              );
            } else {
              items = [...items, { ...item, qty: addQty }];
            }
          }
          return { items };
        });
      },
      removeItem: (lineId) =>
        set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) })),
      removeCombo: (comboId) =>
        set((state) => ({ items: state.items.filter((i) => i.comboId !== comboId) })),
      updateQty: (lineId, qty) => {
        if (qty <= 0) {
          get().removeItem(lineId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (i.lineId === lineId ? { ...i, qty } : i)),
        }));
      },
      actualizarPrecios: (precios) =>
        set((state) => ({
          items: state.items.map((i) => (precios[i.lineId] !== undefined ? { ...i, price: precios[i.lineId] } : i)),
        })),
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
    }),
    {
      name: "gm-cart",
      // v1: cada línea tiene lineId. Los carritos guardados antes usan su id de producto.
      version: 1,
      migrate: (persisted, version) => {
        const estado = (persisted ?? {}) as { items?: Partial<CartItem>[] };
        if (version < 1 && Array.isArray(estado.items)) {
          estado.items = estado.items.map((i) => ({ ...i, lineId: i.lineId ?? calcLineId(i.id as string, i.opciones) }));
        }
        return estado as unknown as CartState;
      },
    }
  )
);
