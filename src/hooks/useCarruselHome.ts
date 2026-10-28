// src/hooks/useCarruselHome.ts
// Diapositivas manuales del home, cargadas desde el panel (/carrusel).
// Si la tabla no existe todavía o falla la consulta, devuelve [] y el carrusel sigue con las automáticas.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SlideManual {
  id: string;
  imagen_url: string;
  etiqueta: string | null;
  titulo: string | null;
  bajada: string | null;
  cta: string | null;
  enlace: string | null;
}

/** Optimiza una URL de Cloudinary para el carrusel (ancho 1600, calidad y formato automáticos). */
export function slideImg(url: string, w = 1600) {
  return url.includes("res.cloudinary.com") && url.includes("/upload/") && !/\/upload\/[a-z]_/.test(url)
    ? url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`)
    : url;
}

async function fetchSlides(): Promise<SlideManual[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("carrusel_slides")
    .select("id, imagen_url, etiqueta, titulo, bajada, cta, enlace, desde, hasta")
    .eq("publicado", true)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  const ahora = Date.now();
  return ((data ?? []) as (SlideManual & { desde: string | null; hasta: string | null })[])
    .filter((s) => /^https:\/\//i.test(s.imagen_url))
    .filter(
      (s) =>
        (!s.desde || new Date(s.desde).getTime() <= ahora) &&
        (!s.hasta || new Date(s.hasta).getTime() >= ahora),
    );
}

export function useCarruselManual() {
  return useQuery({ queryKey: ["carrusel-publico"], staleTime: 5 * 60_000, retry: 1, queryFn: fetchSlides });
}
