// src/hooks/useEventTracking.ts
import { supabase } from "@/integrations/supabase/client";
import { getStoredUtm } from "./useUtm";

const SESSION_KEY = "gm_session_id";

function getSessionId(): string {
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
};

export async function trackEvent(params: EventParams) {
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