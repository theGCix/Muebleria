// src/lib/head.ts
// Único dueño de las etiquetas del <head> (título, metas, Open Graph, canonical, JSON-LD).
//
// Por qué existe: la app es una SPA con React 18 y <HeadContent/> de TanStack Router no puede
// escribir en <head> (renderiza dentro del body), así que los `head()` de las rutas no tenían efecto.
//
// Capas (la de abajo gana):  index.html (base)  →  head() de la ruta  →  useSeo() de la página.
// En cada actualización se restaura todo lo anterior, así nunca quedan metas "pegadas" de otra página.
import { APP_URL } from "@/config";
import { esRutaNoIndexable } from "@/lib/rutas";

export type Meta = Record<string, unknown>;
export interface HeadLayer {
  metas: Meta[];
  links: Meta[];
}

const MARK = "data-gm-head"; // etiquetas creadas por nosotros
const ORIG = "data-gm-orig"; // metas estáticas de index.html que modificamos (guarda el valor original)
// Título base: el prerenderizado (scripts/prerender.mjs) guarda el título genérico original en <html data-gm-base-title>
const BASE_TITLE =
  typeof document !== "undefined" ? (document.documentElement.getAttribute("data-gm-base-title") ?? document.title) : "";

let ruta: HeadLayer & { path: string } = { metas: [], links: [], path: "" };
let pagina: HeadLayer | null = null;
let pendiente = false;

/** URL pública del sitio (dominio propio o onrender), sin "/" final. */
export function siteBase(): string {
  const base = (APP_URL as string | undefined) || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/\/+$/, "");
}

const claveMeta = (m: Meta): string | null =>
  m.name ? `name:${m.name}` : m.property ? `property:${m.property}` : null;

// "property:og:title" → ["property", "og:title"] (se parte solo en el primer ":")
const partirClave = (k: string): [string, string] => {
  const i = k.indexOf(":");
  return [k.slice(0, i), k.slice(i + 1)];
};

function programar() {
  if (pendiente) return;
  pendiente = true;
  queueMicrotask(() => {
    pendiente = false;
    aplicar();
  });
}

export function setRouteHead(metas: Meta[], links: Meta[], path: string) {
  ruta = { metas, links, path };
  programar();
}

export function setPageHead(layer: HeadLayer | null) {
  pagina = layer;
  programar();
}

function aplicar() {
  if (typeof document === "undefined") return;
  const head = document.head;

  // 1) deshacer lo anterior
  head.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove());
  head.querySelectorAll(`meta[${ORIG}]`).forEach((el) => {
    el.setAttribute("content", el.getAttribute(ORIG) ?? "");
    el.removeAttribute(ORIG);
  });

  // 2) combinar capas: la última (página) gana sobre la ruta
  const capas: Meta[] = [...ruta.metas, ...(pagina?.metas ?? [])];
  let titulo: string | undefined;
  const finales = new Map<string, Meta>();
  const anonimas: Meta[] = [];
  const lds: unknown[] = [];

  for (const m of capas) {
    if (!m) continue;
    if (m.title) titulo = String(m.title);
    else if ("script:ld+json" in m) lds.push(m["script:ld+json"]);
    else {
      const k = claveMeta(m);
      if (k) finales.set(k, m);
      else if (m["http-equiv"] || m.httpEquiv) anonimas.push(m);
      // otras metas sin name/property (charSet, viewport duplicado…) se ignoran a propósito
    }
  }

  // 3) valores por defecto razonables
  const enlaces = new Map<string, Meta>();
  for (const l of [...ruta.links, ...(pagina?.links ?? [])]) if (l?.rel) enlaces.set(String(l.rel), l);

  const path = ruta.path || window.location.pathname;
  if (!enlaces.has("canonical")) enlaces.set("canonical", { rel: "canonical", href: `${siteBase()}${path}` });
  const canonical = String(enlaces.get("canonical")!.href);

  const poner = (k: string, content: unknown) => {
    if (!finales.has(k) && content) {
      const [attr, val] = partirClave(k);
      finales.set(k, { [attr]: val, content });
    }
  };
  const desc = finales.get("name:description")?.content;
  poner("property:og:title", titulo);
  poner("property:og:description", desc);
  poner("property:og:url", canonical);
  if (esRutaNoIndexable(path) && !finales.has("name:robots")) {
    finales.set("name:robots", { name: "robots", content: "noindex, nofollow" });
  }

  // 4) escribir en el <head>
  document.title = titulo ?? BASE_TITLE;

  for (const [k, m] of finales) {
    const [attr, val] = partirClave(k);
    const existente = head.querySelector<HTMLMetaElement>(`meta[${attr}="${val}"]:not([${MARK}])`);
    if (existente) {
      if (!existente.hasAttribute(ORIG)) existente.setAttribute(ORIG, existente.getAttribute("content") ?? "");
      existente.setAttribute("content", String(m.content ?? ""));
    } else {
      const el = document.createElement("meta");
      Object.entries(m).forEach(([a, v]) => v != null && el.setAttribute(a, String(v)));
      el.setAttribute(MARK, "1");
      head.appendChild(el);
    }
  }
  for (const m of anonimas) {
    const el = document.createElement("meta");
    Object.entries(m).forEach(([a, v]) => v != null && el.setAttribute(a, String(v)));
    el.setAttribute(MARK, "1");
    head.appendChild(el);
  }
  for (const l of enlaces.values()) {
    const el = document.createElement("link");
    Object.entries(l).forEach(([a, v]) => v != null && el.setAttribute(a, String(v)));
    el.setAttribute(MARK, "1");
    head.appendChild(el);
  }
  for (const ld of lds) {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.setAttribute(MARK, "1");
    // evita cerrar el <script> por accidente con "</script>" dentro de textos
    s.textContent = JSON.stringify(ld).replace(/</g, "\\u003c");
    head.appendChild(s);
  }
}
