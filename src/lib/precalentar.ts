// src/lib/precalentar.ts
// Render (plan gratuito) duerme el servidor tras un rato sin tráfico y despertarlo tarda 30-60 s.
// Un GET liviano a /health al abrir el carrito o el checkout lo despierta ANTES de cobrar,
// para que /api/orders no se quede colgado justo después de que el cliente pagó.
import { API_URL } from "@/config";

let ultimo = 0;

export function precalentarServidor(): void {
  if (typeof window === "undefined" || !API_URL) return;
  const ahora = Date.now();
  if (ahora - ultimo < 4 * 60_000) return; // como mucho una vez cada 4 min
  ultimo = ahora;
  fetch(`${API_URL}/health`, { method: "GET", cache: "no-store" }).catch(() => {
    ultimo = 0; // si falló, permitir reintentar
  });
}
