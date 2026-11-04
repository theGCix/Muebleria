// src/hooks/useValidarCarrito.ts
// Revisa el carrito contra el servidor (precios vigentes, stock, combos) al abrirlo o al entrar al checkout.
// El servidor es la fuente de verdad: si un precio cambió, se corrige en el carrito y se AVISA (antes → ahora).
// Si la red falla o Render está "frío", no bloquea nada: /api/orders vuelve a validar al cobrar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/config";
import { calcLineId, useCartStore } from "@/stores/cartStore";

export type TipoAviso =
  | "precio_cambio"
  | "no_disponible"
  | "sin_stock"
  | "stock_insuficiente"
  | "combo_no_disponible"
  | "opcion_no_disponible";

export interface AvisoCarrito {
  id: string; // product_id
  lineId: string; // línea del carrito (producto + opciones)
  comboId: string | null;
  title: string;
  tipo: TipoAviso;
  antes?: number;
  ahora?: number;
  stock?: number | null;
}

interface LineaValidada {
  product_id: string;
  comboId: string | null;
  opciones?: string[] | null;
  estado: "ok" | TipoAviso;
  precio_actual: number | null;
  precio_cliente: number;
  stock: number | null;
}

const TIMEOUT_MS = 20_000;

export function useValidarCarrito(activo = true) {
  const items = useCartStore((s) => s.items);
  const [avisos, setAvisos] = useState<AvisoCarrito[]>([]);
  const [validando, setValidando] = useState(false);
  const reqId = useRef(0);

  const validar = useCallback(async () => {
    const { items: actuales, actualizarPrecios } = useCartStore.getState();
    if (actuales.length === 0) {
      setAvisos([]);
      return;
    }
    const id = ++reqId.current;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    setValidando(true);
    try {
      const res = await fetch(`${API_URL}/api/carrito/validar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          items: actuales.map((i) => ({ product_id: i.id, qty: i.qty, price: i.price, comboId: i.comboId ?? null, opciones: i.opciones })),
        }),
      });
      if (!res.ok) return; // silencioso: el cobro revalida en el servidor
      const data = (await res.json()) as { lineas: LineaValidada[] };
      if (id !== reqId.current) return; // llegó una respuesta más nueva

      const titulo = new Map(actuales.map((i) => [i.lineId, i.title]));
      const nuevos: AvisoCarrito[] = [];
      const precios: Record<string, number> = {};
      for (const l of data.lineas) {
        // Mismo cálculo de línea que el carrito: producto + opciones (las piezas de combo no llevan opciones)
        const lineId = calcLineId(l.product_id, l.comboId ? undefined : l.opciones);
        if (l.precio_actual !== null && Math.abs(l.precio_actual - l.precio_cliente) > 0.009) {
          precios[lineId] = l.precio_actual; // se corrige siempre, aunque además haya aviso de stock
        }
        if (l.estado === "ok") continue;
        nuevos.push({
          id: l.product_id,
          lineId,
          comboId: l.comboId ?? null,
          title: titulo.get(lineId) ?? "Producto",
          tipo: l.estado,
          antes: l.estado === "precio_cambio" ? l.precio_cliente : undefined,
          ahora: l.estado === "precio_cambio" ? (l.precio_actual ?? undefined) : undefined,
          stock: l.stock,
        });
      }
      if (Object.keys(precios).length) actualizarPrecios(precios);
      setAvisos(nuevos);
    } catch {
      /* sin red o timeout: no se bloquea al cliente */
    } finally {
      clearTimeout(timer);
      if (id === reqId.current) setValidando(false);
    }
  }, []);

  // Solo cuando se activa (abrir el carrito / montar el checkout): NO depende de items, para no entrar en bucle
  // cuando actualizarPrecios modifica el carrito.
  useEffect(() => {
    if (activo) void validar();
  }, [activo, validar]);

  // Un aviso deja de mostrarse si el cliente ya quitó esa línea del carrito.
  const visibles = useMemo(
    () => avisos.filter((a) => items.some((i) => i.lineId === a.lineId && (i.comboId ?? null) === a.comboId)),
    [avisos, items],
  );

  const entendido = useCallback(() => setAvisos([]), []);

  return {
    avisos: visibles,
    /** true mientras haya avisos sin confirmar: el checkout deshabilita Pagar */
    pendiente: visibles.length > 0,
    validando,
    entendido,
    revalidar: validar,
  };
}