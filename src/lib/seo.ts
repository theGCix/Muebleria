// src/lib/seo.ts
// El sitio es una SPA estática: las `head()` de las rutas no se escriben en el HTML.
// Este hook actualiza título, descripción, canonical, Open Graph y JSON-LD en el <head>
// (Google ejecuta JS y los lee; WhatsApp/Facebook no, ver nota en el README del SEO).
import { useEffect } from "react";

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

function upsertMeta(attr: "name" | "property", key: string, content: string | undefined) {
  const sel = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!content) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

const recortar = (t: string, n: number) => {
  const limpio = t.replace(/\s+/g, " ").trim();
  return limpio.length > n ? `${limpio.slice(0, n - 1).trimEnd()}…` : limpio;
};

export function useSeo(input: SeoInput | null | undefined) {
  const json = input?.jsonLd ? JSON.stringify(input.jsonLd) : "";
  const { title, description, image, path, type } = input ?? ({} as Partial<SeoInput>);

  useEffect(() => {
    if (!title) return;
    const prevTitle = document.title;
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const desc = description ? recortar(description, 160) : undefined;
    const url = `${window.location.origin}${path ?? window.location.pathname}`;

    document.title = fullTitle;
    upsertMeta("name", "description", desc);
    upsertCanonical(url);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:type", type ?? "website");
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", "es_PE");
    upsertMeta("property", "og:image", image ?? undefined);
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");

    let script: HTMLScriptElement | null = null;
    if (json) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.gmSeo = "1";
      // evita cerrar el <script> por accidente con "</script>" dentro de textos
      script.textContent = json.replace(/</g, "\\u003c");
      document.head.appendChild(script);
    }

    return () => {
      script?.remove();
      document.title = prevTitle;
    };
  }, [title, description, image, path, type, json]);
}

export const absolutizar = (url?: string | null) =>
  url ? (url.startsWith("http") ? url : `${window.location.origin}${url}`) : undefined;
