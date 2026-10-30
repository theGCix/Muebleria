// src/hooks/useEventTracking.ts
import { supabase } from "@/integrations/supabase/client";
import { getStoredUtm } from "./useUtm";
import { trackViewItem, trackBeginCheckout, trackPurchase, trackAddToCart } from "@/lib/analytics";

const SESSION_KEY = "gm_session_id";

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

type EventParams = {
  tipo: "pagina_vista" | "producto_visto" | "carrito_iniciado" | "checkout_iniciado" | "orden_creada" | "orden_pagada";
  path?: string;
  product_id?: string;
  order_id?: string;
  valor?: number;
  /** Opcional: nombre/categoría para enriquecer GA4 y Meta Pixel */
  nombre?: string;
  categoria?: string | null;
};

/** Reenvía los eventos de negocio a GA4 y Meta Pixel (page_view se manda desde el router). */
function reenviarAnalitica(params: EventParams) {
  try {
    switch (params.tipo) {
      case "producto_visto":
        trackViewItem({
          id: params.product_id ?? params.path ?? "",
          nombre: params.nombre,
          precio: params.valor,
          categoria: params.categoria,
        });
        break;
      case "carrito_iniciado":
        trackAddToCart({ id: params.product_id ?? "", nombre: params.nombre, precio: params.valor });
        break;
      case "checkout_iniciado":
        trackBeginCheckout(params.valor ?? 0);
        break;
      case "orden_pagada":
        if (params.order_id) trackPurchase(params.order_id, params.valor ?? 0);
        break;
    }
  } catch {
    // nunca romper la UX
  }
}

export async function trackEvent(params: EventParams) {
  reenviarAnalitica(params);
  const utm = getStoredUtm();
  try {
    await supabase.from("eventos_web").insert({
      session_id:   getSessionId(),
      tipo:         params.tipo,
      path:         params.path ?? window.location.pathname,
      product_id:   params.product_id ?? null,
      order_id:     params.order_id ?? null,
      valor:        params.valor ?? null,
      utm_source:   utm.utm_source ?? null,
      utm_medium:   utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      user_agent:   navigator.userAgent.slice(0, 200),
    });
  } catch {
    // tracking nunca debe romper la UX
  }
}

