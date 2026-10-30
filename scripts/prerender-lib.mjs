// scripts/prerender-lib.mjs
// Funciones PURAS (sin red ni disco) para el prerenderizado. Las usa scripts/prerender.mjs.
//
// Idea: a partir de dist/index.html (la "carcasa" de la SPA) se genera una copia por página con
// título, metas, canonical, JSON-LD y un resumen en <noscript>, para que los rastreadores que NO
// ejecutan JavaScript (WhatsApp, Facebook, buscadores de IA, etc.) vean el contenido real.
// Cuando la app arranca, src/lib/head.ts retoma el control del <head> sin dejar nada duplicado:
//   · las etiquetas NUEVAS llevan data-gm-head="1"  → head.ts las borra y las vuelve a crear;
//   · las metas que YA existían en index.html se editan en sitio y guardan su valor original en
//     data-gm-orig → head.ts lo restaura y aplica la capa de la página (igual que hoy).

export const MARK = 'data-gm-head="1"';

/** Escapa texto/atributos HTML sin volver a escapar entidades que ya existan (&amp;, &#39;…). */
export const esc = (v) =>
  String(v ?? "")
    .replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const recortar = (t, n = 160) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Busca <meta name|property="clave" ...>. */
function buscarMeta(html, clave) {
  return html.match(new RegExp(`<meta\\s+[^>]*?(?:name|property)="${reEsc(clave)}"[^>]*?>`, "i"));
}

/** Cambia el content de una meta existente (guardando el original) o devuelve una nueva para añadir. */
function fijarMeta(html, extras, tipo, clave, contenido) {
  if (!contenido) return html;
  const m = buscarMeta(html, clave);
  if (m) {
    const etiqueta = m[0];
    const original = (etiqueta.match(/content="([^"]*)"/i) ?? [])[1] ?? "";
    let nueva = etiqueta.replace(/content="[^"]*"/i, `content="${esc(contenido)}"`);
    if (!/data-gm-orig=/.test(nueva)) nueva = nueva.replace(/^<meta/i, `<meta data-gm-orig="${original}"`);
    return html.replace(etiqueta, nueva);
  }
  extras.push(`<meta ${tipo}="${esc(clave)}" content="${esc(contenido)}" ${MARK} />`);
  return html;
}

const quitarMeta = (html, clave) => {
  const m = buscarMeta(html, clave);
  return m ? html.replace(m[0], "") : html;
};

/**
 * Devuelve el HTML de una página a partir de la carcasa.
 * page = { title, description, canonical, image?, type?, jsonLd?: object[], noscript?: string, noindex?: boolean }
 */
export function inyectar(plantilla, page) {
  let html = plantilla;
  const extras = [];

  // Título: se conserva el original en <html data-gm-base-title> para que head.ts lo use como base.
  const t = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (t && page.title) {
    if (!/data-gm-base-title=/.test(html)) html = html.replace(/<html\b/i, `<html data-gm-base-title="${esc(t[1])}"`);
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(page.title)}</title>`);
  }

  const desc = page.description ? recortar(page.description) : "";
  html = fijarMeta(html, extras, "name", "description", desc);
  html = fijarMeta(html, extras, "property", "og:title", page.title);
  html = fijarMeta(html, extras, "property", "og:description", desc);
  html = fijarMeta(html, extras, "property", "og:type", page.type);
  html = fijarMeta(html, extras, "property", "og:url", page.canonical);
  html = fijarMeta(html, extras, "name", "twitter:title", page.title);
  html = fijarMeta(html, extras, "name", "twitter:description", desc);
  if (page.image) {
    html = fijarMeta(html, extras, "property", "og:image", page.image);
    html = fijarMeta(html, extras, "name", "twitter:image", page.image);
    // Las medidas/alt de index.html describen la imagen por defecto, no la del producto
    for (const k of ["og:image:width", "og:image:height", "og:image:alt"]) html = quitarMeta(html, k);
  }
  if (page.noindex) extras.push(`<meta name="robots" content="noindex, nofollow" ${MARK} />`);

  html = html.replace(/<link\s+[^>]*rel="canonical"[^>]*>/i, "");
  if (page.canonical) extras.push(`<link rel="canonical" href="${esc(page.canonical)}" ${MARK} />`);

  for (const ld of page.jsonLd ?? []) {
    // "<" escapado para que un texto con "</script>" no cierre la etiqueta
    extras.push(`<script type="application/ld+json" ${MARK}>${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
  }

  if (extras.length) html = html.replace(/<\/head>/i, `    ${extras.join("\n    ")}\n  </head>`);
  if (page.noscript) html = html.replace(/<div id="root"><\/div>/i, `<noscript>${page.noscript}</noscript>\n    <div id="root"></div>`);
  return html;
}

/* ───────── contenido <noscript> ───────── */

const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const enlaces = (items) =>
  items.length ? `<ul>${items.map((i) => `<li><a href="${esc(i.href)}">${esc(i.texto)}</a></li>`).join("")}</ul>` : "";

const NAV = [
  { href: "/", texto: "Inicio" },
  { href: "/catalogo", texto: "Catálogo" },
  { href: "/nosotros", texto: "Nuestro taller" },
  { href: "/envios", texto: "Envíos y entregas" },
  { href: "/testimonios", texto: "Testimonios" },
];

export function noscriptProducto({ nombre, descripcion, precio, precioOriginal, categoria, imagenes, sitio }) {
  return (
    `<main><nav>${enlaces([...NAV.slice(0, 2), ...(categoria ? [{ href: `/categoria/${categoria.slug}`, texto: categoria.nombre }] : [])])}</nav>` +
    `<h1>${esc(nombre)}</h1>` +
    (imagenes[0] ? `<img src="${esc(imagenes[0])}" alt="${esc(nombre)}" width="600" />` : "") +
    `<p>${esc(soles(precio))}${precioOriginal ? ` (antes ${esc(soles(precioOriginal))})` : ""}</p>` +
    (descripcion ? `<p>${esc(descripcion)}</p>` : "") +
    `<p>Mueble fabricado a pedido en Lima por G&amp;M Mueblería, con entrega a domicilio.</p>` +
    `<p><a href="${esc(sitio)}/catalogo">Ver todo el catálogo</a></p></main>`
  );
}

export function noscriptCombo({ nombre, descripcion, precio, piezas, imagen }) {
  return (
    `<main><nav>${enlaces(NAV.slice(0, 2))}</nav><h1>${esc(nombre)}</h1>` +
    (imagen ? `<img src="${esc(imagen)}" alt="${esc(nombre)}" width="600" />` : "") +
    `<p>${esc(soles(precio))}</p>` +
    (descripcion ? `<p>${esc(descripcion)}</p>` : "") +
    (piezas.length ? `<h2>Incluye</h2><ul>${piezas.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : "") +
    `</main>`
  );
}

/** Páginas de listado (categoría, catálogo, inicio): título, texto y enlaces rastreables a cada producto. */
export function noscriptListado({ titulo, descripcion, productos, categorias = [] }) {
  return (
    `<main><nav>${enlaces(NAV)}</nav><h1>${esc(titulo)}</h1>` +
    (descripcion ? `<p>${esc(descripcion)}</p>` : "") +
    (categorias.length ? `<h2>Categorías</h2>${enlaces(categorias.map((c) => ({ href: `/categoria/${c.slug}`, texto: c.nombre })))}` : "") +
    (productos.length ? `<h2>Productos</h2>${enlaces(productos.map((p) => ({ href: `/product/${p.id}`, texto: p.nombre })))}` : "") +
    `</main>`
  );
}

/* ───────── datos ───────── */

/** JSON-LD BreadcrumbList. items = [{ nombre, path }]; debe coincidir con las migas visibles de la página. */
export function migasLd(sitio, items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.nombre, item: `${sitio}${it.path}` })),
  };
}

export function ofertaInfo(p, ahora = Date.now()) {
  const vence = p.oferta_vence_el ? new Date(p.oferta_vence_el).getTime() : null;
  const activa = !!p.descuento_porcentaje && p.descuento_porcentaje > 0 && (!vence || vence > ahora);
  const precioFinal = activa ? Math.round((p.precio - (p.precio * p.descuento_porcentaje) / 100) * 100) / 100 : p.precio;
  return { activa, precioFinal };
}

export function imagenesDe(row, cloud) {
  const nube = (id) => `https://res.cloudinary.com/${cloud}/image/upload/w_900,q_80,f_auto,h_900/${id}`;
  const g = row.imagenes;
  if (Array.isArray(g) && g.length > 0) {
    return g.map((i) => (i?.public_id && cloud ? nube(i.public_id) : i?.url)).filter(Boolean);
  }
  if (row.imagen_public_id && cloud) return [nube(row.imagen_public_id)];
  if (row.imagen_url) return [row.imagen_url];
  return [];
}

/** Extrae las categorías de primer nivel de src/lib/categories.ts (slug, nombre, heroDescripcion). */
export function leerCategorias(fuente) {
  const re = /^ {4}slug:\s*"([a-z0-9-]+)",\s*\n\s*nombre:\s*"([^"]+)",[\s\S]*?heroDescripcion:\s*"([^"]+)"/gm;
  return [...fuente.matchAll(re)].map((m) => ({ slug: m[1], nombre: m[2], descripcion: m[3] }));
}

export function paginaProducto(p, { sitio, cloud, categorias }) {
  const cat = categorias.find((c) => c.slug === p.categoria);
  const { activa, precioFinal } = ofertaInfo(p);
  const imgs = imagenesDe(p, cloud);
  const canonical = `${sitio}/product/${p.id}`;
  const title = `${[p.nombre, cat?.nombre || p.categoria, p.material_base].filter(Boolean).join(" · ")} | G&M Mueblería`;
  const description =
    p.descripcion ||
    `${p.nombre}${p.categoria ? ` — ${p.categoria}` : ""} fabricado a pedido en Lima por G&M Mueblería. Entrega a domicilio y 2 años de garantía en estructura.`;
  return {
    ruta: `/product/${p.id}`,
    page: {
      title,
      description,
      canonical,
      image: imgs[0],
      type: "product",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.nombre,
          description: p.descripcion || undefined,
          sku: p.sku || p.id,
          category: p.categoria || undefined,
          material: p.material_base || undefined,
          image: imgs,
          brand: { "@type": "Brand", name: "G&M Mueblería" },
          offers: {
            "@type": "Offer",
            url: canonical,
            priceCurrency: "PEN",
            price: Number(precioFinal).toFixed(2),
            availability: (p.stock ?? 1) <= 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@type": "Organization", name: "G&M Mueblería" },
          },
        },
        migasLd(sitio, [
          { nombre: "Inicio", path: "/" },
          ...(cat ? [{ nombre: cat.nombre, path: `/categoria/${cat.slug}` }] : []),
          { nombre: p.nombre, path: `/product/${p.id}` },
        ]),
      ],
      noscript: noscriptProducto({
        nombre: p.nombre, descripcion: p.descripcion, precio: precioFinal, precioOriginal: activa ? p.precio : null,
        categoria: cat, imagenes: imgs, sitio,
      }),
    },
  };
}

export function paginaCombo(c, { sitio, cloud }) {
  const piezas = (c.combo_items ?? []).map((it) => it.products?.nombre).filter(Boolean);
  const imgs = c.imagen_public_id && cloud ? imagenesDe(c, cloud) : c.imagen_url ? [c.imagen_url] : imagenesDe(c.combo_items?.[0]?.products ?? {}, cloud);
  const canonical = `${sitio}/combo/${c.id}`;
  return {
    ruta: `/combo/${c.id}`,
    page: {
      title: `${c.nombre} — Combo de muebles | G&M Mueblería`,
      description:
        c.descripcion || `Combo ${c.nombre}: ${piezas.join(", ")}. Ahorra comprando el conjunto. Fabricado en Lima por G&M Mueblería.`,
      canonical,
      image: imgs[0],
      type: "product",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: c.nombre,
          description: c.descripcion || undefined,
          image: imgs,
          brand: { "@type": "Brand", name: "G&M Mueblería" },
          offers: {
            "@type": "Offer", url: canonical, priceCurrency: "PEN", price: Number(c.precio_combo).toFixed(2),
            availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "G&M Mueblería" },
          },
        },
        migasLd(sitio, [
          { nombre: "Inicio", path: "/" },
          { nombre: "Combos", path: "/#combos" },
          { nombre: c.nombre, path: `/combo/${c.id}` },
        ]),
      ],
      noscript: noscriptCombo({ nombre: c.nombre, descripcion: c.descripcion, precio: c.precio_combo, piezas, imagen: imgs[0] }),
    },
  };
}
