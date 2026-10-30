// server/feed.js
// ════════════════════════════════════════════════════════════════
// FEED DE PRODUCTOS: GET /feed/productos.xml (RSS 2.0 con el espacio de nombres g:)
// Sirve para dos destinos con el mismo archivo:
//   · Google Merchant Center  (Shopping, fichas gratuitas y campañas de Google Ads)
//   · Catálogo de Meta        (Instagram / Facebook Shops y anuncios dinámicos)
// Se arma en vivo desde la base de datos con una caché corta: cambia un precio o agrega un
// producto y el feed lo refleja solo en el siguiente rastreo.
//
// Conexión en server/index.js:
//   import { registerFeed } from "./feed.js";
//   registerFeed({ app, supabaseAdmin, rateLimit });   // antes de app.listen()
//
// Variables de entorno del servidor:
//   SITE_URL (o VITE_APP_URL_PROD, o FRONTEND_URL)   URL pública de la tienda
//   CLOUDINARY_CLOUD_NAME (o VITE_CLOUDINARY_CLOUD_NAME)   para construir las imágenes
//   FEED_TTL_SECONDS                                  caché en memoria (por defecto 900 = 15 min)
//
// Qué NO incluye a propósito: envío (se configura en la cuenta de Merchant Center / Meta) ni GTIN
// (son muebles propios, sin código de barras: va identifier_exists=no con marca y SKU como MPN).
// ════════════════════════════════════════════════════════════════
import { urlSitio } from "./sitemap.js";

const MARCA = "G&M Mueblería";
const CATEGORIA_GOOGLE = "Furniture"; // ID 436 en la taxonomía de Google; se puede afinar por categoría después

// Nombres de las categorías (src/lib/categories.ts). El servidor se despliega solo con server/,
// así que no puede leer ese archivo: si agregas una categoría, añádela aquí.
export const NOMBRES_CATEGORIA = {
  muebles: "Muebles",
  comedores: "Comedores",
  recamaras: "Recámaras",
  separadores: "Separadores de ambiente",
  accesorios: "Accesorios",
};

const PAGINA_DB = 1000;
const MAX_FILAS = 10000;
const COLUMNAS =
  "id,nombre,descripcion,precio,descuento_porcentaje,oferta_vence_el,stock,sku,categoria,material_base,imagenes,imagen_public_id,imagen_url";

// Caracteres no permitidos en XML 1.0 (controles salvo tab/salto de línea)
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
export const xml = (v) =>
  String(v ?? "")
    .replace(CONTROL, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const recortar = (t, n) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

const pen = (n) => `${Number(n).toFixed(2)} PEN`;

function cloudName() {
  return (process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();
}

/** Imágenes del producto, en orden: galería → public_id → url. JPG de hasta 1200 px, sin deformar. */
export function imagenesDe(row, cloud = cloudName()) {
  const nube = (id) => `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_1200,q_auto,f_jpg/${id}`;
  const g = row.imagenes;
  if (Array.isArray(g) && g.length > 0) {
    return g.map((i) => (i?.public_id && cloud ? nube(i.public_id) : i?.url)).filter((u) => /^https?:\/\//.test(u ?? ""));
  }
  if (row.imagen_public_id && cloud) return [nube(row.imagen_public_id)];
  if (row.imagen_url && /^https?:\/\//.test(row.imagen_url)) return [row.imagen_url];
  return [];
}

/** Precio normal, precio de oferta (si está vigente) y vigencia. Misma regla que la tienda. */
export function preciosDe(p, ahora = Date.now()) {
  const vence = p.oferta_vence_el ? new Date(p.oferta_vence_el).getTime() : null;
  const activa = !!p.descuento_porcentaje && p.descuento_porcentaje > 0 && (!vence || vence > ahora);
  const oferta = activa ? Math.round(p.precio * (1 - p.descuento_porcentaje / 100) * 100) / 100 : null;
  return { precio: p.precio, oferta, vence: activa && vence ? new Date(vence) : null };
}

/** Un <item> del feed. Devuelve null si falta algo obligatorio (imagen o precio válido). */
export function itemDe(p, sitio, cloud = cloudName(), ahora = Date.now()) {
  const imgs = imagenesDe(p, cloud);
  const precio = Number(p.precio);
  if (!imgs.length || !Number.isFinite(precio) || precio <= 0 || !p.nombre) return null;

  const { oferta, vence } = preciosDe(p, ahora);
  const categoria = NOMBRES_CATEGORIA[p.categoria] ?? p.categoria;
  const titulo = recortar([p.nombre, p.material_base].filter(Boolean).join(" - "), 150);
  const descripcion = recortar(
    p.descripcion || `${p.nombre}${categoria ? ` (${categoria})` : ""} fabricado a pedido en Lima por ${MARCA}. Entrega a domicilio.`,
    5000,
  );

  const l = [
    `<g:id>${xml(String(p.id).slice(0, 50))}</g:id>`,
    `<g:title>${xml(titulo)}</g:title>`,
    `<g:description>${xml(descripcion)}</g:description>`,
    `<g:link>${xml(`${sitio}/product/${p.id}`)}</g:link>`,
    `<g:image_link>${xml(imgs[0])}</g:image_link>`,
    ...imgs.slice(1, 11).map((u) => `<g:additional_image_link>${xml(u)}</g:additional_image_link>`),
    `<g:availability>${(p.stock ?? 1) <= 0 ? "out_of_stock" : "in_stock"}</g:availability>`,
    `<g:price>${pen(precio)}</g:price>`,
  ];
  if (oferta != null && oferta > 0 && oferta < precio) {
    l.push(`<g:sale_price>${pen(oferta)}</g:sale_price>`);
    if (vence) l.push(`<g:sale_price_effective_date>${new Date(ahora).toISOString()}/${vence.toISOString()}</g:sale_price_effective_date>`);
  }
  l.push(
    `<g:condition>new</g:condition>`,
    `<g:brand>${xml(MARCA)}</g:brand>`,
    `<g:identifier_exists>no</g:identifier_exists>`,
  );
  if (p.sku) l.push(`<g:mpn>${xml(String(p.sku).slice(0, 70))}</g:mpn>`);
  l.push(`<g:google_product_category>${CATEGORIA_GOOGLE}</g:google_product_category>`);
  if (categoria) l.push(`<g:product_type>${xml(categoria)}</g:product_type>`);
  if (p.material_base) l.push(`<g:material>${xml(p.material_base)}</g:material>`);
  return `    <item>\n      ${l.join("\n      ")}\n    </item>`;
}

/** Documento completo. Devuelve también cuántos productos se omitieron por datos incompletos. */
export function construirFeed(sitio, productos, cloud = cloudName(), ahora = Date.now()) {
  const items = [];
  let omitidos = 0;
  const vistos = new Set();
  for (const p of productos) {
    if (vistos.has(p.id)) continue; // el id debe ser único
    vistos.add(p.id);
    const it = itemDe(p, sitio, cloud, ahora);
    if (it) items.push(it);
    else omitidos++;
  }
  const doc =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n` +
    `    <title>${xml(MARCA)}</title>\n    <link>${xml(sitio)}</link>\n` +
    `    <description>Catálogo de muebles de ${xml(MARCA)}</description>\n` +
    `${items.join("\n")}\n  </channel>\n</rss>\n`;
  return { xml: doc, total: items.length, omitidos };
}

async function leerProductos(supabase) {
  const filas = [];
  for (let desde = 0; desde < MAX_FILAS; desde += PAGINA_DB) {
    const { data, error } = await supabase
      .from("products")
      .select(COLUMNAS)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .range(desde, desde + PAGINA_DB - 1);
    if (error) throw error;
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA_DB) break;
  }
  return filas;
}

export function registerFeed({ app, supabaseAdmin, rateLimit }) {
  const ttl = Math.max(0, Number(process.env.FEED_TTL_SECONDS ?? 900)) * 1000;
  const limitador = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });

  let cache = null; // { xml, expira }
  let enCurso = null; // varias peticiones a la vez comparten una sola lectura

  app.get("/feed/productos.xml", limitador, async (_req, res) => {
    const sitio = urlSitio();
    if (!/^https?:\/\//.test(sitio)) {
      return res.status(503).type("text/plain").send("Define SITE_URL (https://...) en el servidor para generar el feed.");
    }

    if (!cache || cache.expira <= Date.now()) {
      if (!enCurso) {
        enCurso = leerProductos(supabaseAdmin)
          .then((productos) => {
            const f = construirFeed(sitio, productos);
            if (f.omitidos) console.warn(`[feed] ${f.omitidos} producto(s) omitidos por falta de imagen o precio válido.`);
            cache = { xml: f.xml, expira: Date.now() + ttl };
          })
          // Si la BD falla se conserva la última versión buena (si la hay) y se reintenta en 1 min
          .catch((err) => {
            console.warn("[feed] Error generando:", err?.message ?? err);
            if (cache) cache.expira = Date.now() + 60_000;
          })
          .finally(() => {
            enCurso = null;
          });
      }
      await enCurso;
    }

    // Sin caché previa y con la BD caída, NO se publica un feed vacío (Merchant lo leería como "borra todo")
    if (!cache) return res.status(503).set("Retry-After", "60").type("text/plain").send("Feed no disponible por ahora.");
    res
      .status(200)
      .set({
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": `public, max-age=${Math.round(Math.min(ttl, 900_000) / 1000)}`,
      })
      .send(cache.xml);
  });
}
