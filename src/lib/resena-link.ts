// src/lib/resena-link.ts
// Enlace y mensaje para pedirle al cliente su reseña y fotos una vez entregado el pedido.
import { APP_URL } from "@/config";

/** Enlace público para reseñar el pedido (desde ahí el cliente también puede subir fotos). */
export function enlaceResena(orderId: string): string {
  const base = (APP_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  return `${base}/resena/${orderId}`;
}

/** Texto listo para WhatsApp. */
export function mensajeResena(nombre: string | null | undefined, numeroPedido: string | null | undefined, orderId: string): string {
  const primer = (nombre ?? "").trim().split(" ")[0];
  return (
    `Hola${primer ? ` ${primer}` : ""}, te escribimos de G&M Mueblería. ` +
    `¿Ya disfrutas tu pedido${numeroPedido ? ` ${numeroPedido}` : ""}? ` +
    `Nos encantaría saber qué te pareció y ver cómo quedó en tu casa. ` +
    `Déjanos tu reseña y tus fotos aquí (toma 2 minutos): ${enlaceResena(orderId)}`
  );
}