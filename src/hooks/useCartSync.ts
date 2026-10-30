import { useEffect } from "react";
import { useCartStore } from "@/stores/cartStore";
import { syncCartSnapshot } from "@/lib/carrito.functions";
import { getSessionId } from "@/hooks/useEventTracking";

const ESPERA_MS = 5000; // evita una petición por cada clic

export function useCartSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const enviar = () => {
      const sessionId = getSessionId();
      if (!sessionId) return;
      const items = useCartStore.getState().items;
      syncCartSnapshot({
        session_id: sessionId,
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          price: i.price,
          qty: i.qty,
          image: i.image,
          sku: i.sku,
        })),
        subtotal: items.reduce((s, i) => s + i.price * i.qty, 0),
      });
    };

    const unsubscribe = useCartStore.subscribe((state, prev) => {
      if (state.items === prev.items) return;
      clearTimeout(timer);
      timer = setTimeout(enviar, ESPERA_MS);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}