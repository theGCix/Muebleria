// src/lib/share.ts
// Enlaces para COMPARTIR con vista previa (imagen, nombre y precio) en WhatsApp/Facebook/Instagram.
// Apuntan al endpoint de la API (server/share.js), que sirve las metas Open Graph y redirige a la tienda.
// Si no hay API configurada, se comparte la URL normal de la página.
import { API_URL } from "@/config";

export function urlCompartir(tipo: "product" | "combo", id: string): string {
  const api = ((API_URL as string | undefined) ?? "").replace(/\/+$/, "");
  if (!api) return `${window.location.origin}/${tipo}/${id}`;
  return `${api}/share/${tipo}/${id}`;
}
