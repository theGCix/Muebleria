// src/lib/seo.ts
// SEO de página: título, descripción, canonical, Open Graph y JSON-LD.
// El <head> lo administra src/lib/head.ts (que también aplica los `head()` de cada ruta);
// este hook solo aporta la capa de la página y la retira al salir, sin dejar metas pegadas.
// Nota: Google ejecuta JS y lo lee; WhatsApp/Facebook no (ver endpoint de compartir en el README del SEO).
import { useEffect } from "react";
import { setPageHead, siteBase, type HeadLayer, type Meta } from "@/lib/head";

const SITE_NAME = "G&M Mueblería";

export type SeoInput = {
  title: string;
  description?: string | null;
  image?: string | null;
  /** Ruta canónica, ej. "/product/abc". Por defecto la ruta actual. */
  path?: string;
  type?: "website" | "product";
  /** Objeto(s) JSON-LD (schema.org) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null;
};

const recortar = (t: string, n: number) => {
  const limpio = t.replace(/\s+/g, " ").trim();
  return limpio.length > n ? `${limpio.slice(0, n - 1).trimEnd()}…` : limpio;
};

function capaSeo({ title, description, image, path, type, jsonLd }: SeoInput): HeadLayer {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const desc = description ? recortar(description, 160) : undefined;
  const url = `${siteBase()}${path ?? window.location.pathname}`;

  const metas: Meta[] = [
    { title: fullTitle },
    { property: "og:title", content: fullTitle },
    { property: "og:type", content: type ?? "website" },
    { property: "og:url", content: url },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: fullTitle },
  ];
  if (desc) {
    metas.push(
      { name: "description", content: desc },
      { property: "og:description", content: desc },
      { name: "twitter:description", content: desc },
    );
  }
  if (image) metas.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
  for (const ld of Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []) metas.push({ "script:ld+json": ld });

  return { metas, links: [{ rel: "canonical", href: url }] };
}

export function useSeo(input: SeoInput | null | undefined) {
  const json = input?.jsonLd ? JSON.stringify(input.jsonLd) : "";
  const { title, description, image, path, type } = input ?? ({} as Partial<SeoInput>);

  useEffect(() => {
    if (!title) return;
    setPageHead(capaSeo({ title, description, image, path, type, jsonLd: json ? JSON.parse(json) : null }));
    return () => setPageHead(null);
  }, [title, description, image, path, type, json]);
}

/** JSON-LD BreadcrumbList. Debe reflejar las migas que se ven en la página (Google lo exige). */
export function migasJsonLd(items: { nombre: string; path: string }[]): Record<string, unknown> {
  const base = siteBase();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.nombre,
      item: `${base}${it.path}`,
    })),
  };
}

export const absolutizar = (url?: string | null) =>
  url ? (url.startsWith("http") ? url : `${siteBase()}${url.startsWith("/") ? "" : "/"}${url}`) : undefined;
