// server/sitemap.js
// ════════════════════════════════════════════════════════════════
// SITEMAP DINÁMICO: GET /sitemap.xml se arma en vivo desde la base de datos.
// Cuando agregas, desactivas o vences un producto/combo, el sitemap lo refleja solo
// (con una caché corta en memoria), sin volver a desplegar la tienda.
//
// Conexión en server/index.js:
//   import { registerSitemap } from "./sitemap.js";
//   registerSitemap({ app, supabaseAdmin, rateLimit });   // antes de app.listen()
//
// Variables de entorno del servidor (la primera que exista):
//   SITE_URL  →  VITE_APP_URL_PROD  →  FRONTEND_URL      URL pública de la tienda (https://...)
//   SITEMAP_TTL_SECONDS                                  caché en memoria (por defecto 600 = 10 min)
//
// Si la base de datos falla, sirve la última versión buena en caché; si nunca hubo una,
// responde solo con páginas fijas y categorías (nunca un 500 al rastreador).
// ════════════════════════════════════════════════════════════════

// Páginas fijas. Mantén esta lista alineada con scripts/generate-sitemap.mjs y src/lib/rutas.ts.
const PAGINAS = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/catalogo", changefreq: "daily", priority: "0.9" },
  { path: "/nosotros", changefreq: "monthly", priority: "0.6" },
  { path: "/proyectos", changefreq: "weekly", priority: "0.6" },
  { path: "/testimonios", changefreq: "weekly", priority: "0.6" },
  { path: "/envios", changefreq: "yearly", priority: "0.3" },
  { path: "/terminos", changefreq: "yearly", priority: "0.3" },
  { path: "/privacidad", changefreq: "yearly", priority: "0.3" },
];

// Categorías de primer nivel (src/lib/categories.ts). El servidor se despliega solo con la
// carpeta server/, así que no puede leer ese archivo: si agregas una categoría, añádela aquí.
export const CATEGORIAS = ["muebles", "comedores", "recamaras", "separadores", "accesorios"];

const PAGINA_DB = 1000; // Supabase devuelve como máximo 1000 filas por consulta
const MAX_FILAS = 10000; // tope de seguridad por tabla (el límite de Google es 50 000 URLs por sitemap)

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fechaISO(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function urlSitio() {
  const v = (process.env.SITE_URL || process.env.VITE_APP_URL_PROD || process.env.FRONTEND_URL || "").trim();
  return v.replace(/\/+$/, "");
}

/** Construye el XML a partir de las entradas { path, lastmod?, changefreq, priority }. Función pura. */
export function construirSitemap(sitio, entradas) {
  const urls = entradas.map((e) => {
    const lastmod = fechaISO(e.lastmod);
    return (
      `  <url>\n    <loc>${esc(sitio + e.path)}</loc>\n` +
      (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : "") +
      `    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
    );
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** Lee todas las filas de una consulta paginando de a 1000. `armar(desde, hasta)` devuelve la consulta. */
async function leerTodo(armar) {
  const filas = [];
  for (let desde = 0; desde < MAX_FILAS; desde += PAGINA_DB) {
    const { data, error } = await armar(desde, desde + PAGINA_DB - 1);
    if (error) throw error;
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA_DB) break;
  }
  return filas;
}

const columnaInexistente = (err) => /column|does not exist|42703|PGRST204/i.test(`${err?.code ?? ""} ${err?.message ?? ""}`);

/** Productos activos. Si la tabla aún no tiene `updated_at`, reintenta solo con `created_at`. */
async function leerProductos(supabase) {
  const consulta = (columnas) =>
    leerTodo((a, b) =>
      supabase.from("products").select(columnas).eq("activo", true).order("created_at", { ascending: false }).range(a, b),
    );
  try {
    return await consulta("id,created_at,updated_at");
  } catch (err) {
    if (!columnaInexistente(err)) throw err;
    return consulta("id,created_at");
  }
}

/** Combos activos y no vencidos. */
async function leerCombos(supabase) {
  const ahora = new Date().toISOString();
  const consulta = (columnas) =>
    leerTodo((a, b) =>
      supabase
        .from("combos")
        .select(columnas)
        .eq("activo", true)
        .or(`vence_el.is.null,vence_el.gt.${ahora}`)
        .order("created_at", { ascending: false })
        .range(a, b),
    );
  try {
    return await consulta("id,created_at,updated_at");
  } catch (err) {
    if (!columnaInexistente(err)) throw err;
    return consulta("id,created_at");
  }
}

/** Arma todas las entradas. Si una tabla falla, la omite y lo informa en `parcial`. */
export async function reunirEntradas(supabase, log = console) {
  const entradas = [
    ...PAGINAS,
    ...CATEGORIAS.map((slug) => ({ path: `/categoria/${slug}`, changefreq: "weekly", priority: "0.8" })),
  ];
  let parcial = false;

  try {
    for (const p of await leerProductos(supabase))
      entradas.push({ path: `/product/${p.id}`, lastmod: p.updated_at ?? p.created_at, changefreq: "weekly", priority: "0.8" });
  } catch (err) {
    parcial = true;
    log.warn("[sitemap] No pude leer productos:", err?.message ?? err);
  }
  try {
    for (const c of await leerCombos(supabase))
      entradas.push({ path: `/combo/${c.id}`, lastmod: c.updated_at ?? c.created_at, changefreq: "weekly", priority: "0.7" });
  } catch (err) {
    parcial = true;
    log.warn("[sitemap] No pude leer combos:", err?.message ?? err);
  }
  return { entradas, parcial };
}

export function registerSitemap({ app, supabaseAdmin, rateLimit }) {
  const ttl = Math.max(0, Number(process.env.SITEMAP_TTL_SECONDS ?? 600)) * 1000;
  const limitador = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });

  let cache = null; // { xml, expira, completo }
  let enCurso = null; // promesa compartida: varias peticiones simultáneas = una sola lectura a la BD

  async function generar(sitio) {
    const { entradas, parcial } = await reunirEntradas(supabaseAdmin);
    return { xml: construirSitemap(sitio, entradas), completo: !parcial };
  }

  app.get("/sitemap.xml", limitador, async (_req, res) => {
    const sitio = urlSitio();
    if (!/^https?:\/\//.test(sitio)) {
      return res.status(503).type("text/plain").send("Define SITE_URL (https://...) en el servidor para generar el sitemap.");
    }

    const ahora = Date.now();
    if (!cache || cache.expira <= ahora) {
      if (!enCurso) {
        enCurso = generar(sitio)
          .then(({ xml, completo }) => {
            // Un resultado incompleto (la BD falló) no pisa una versión completa que ya teníamos.
            if (completo || !cache?.completo) cache = { xml, completo, expira: Date.now() + (completo ? ttl : Math.min(ttl, 60_000)) };
            else cache.expira = Date.now() + 60_000; // reintentar en 1 min
          })
          .catch((err) => console.warn("[sitemap] Error generando:", err?.message ?? err))
          .finally(() => {
            enCurso = null;
          });
      }
      await enCurso;
    }

    if (!cache) return res.status(503).type("text/plain").send("Sitemap no disponible por ahora.");
    res
      .status(200)
      .set({
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": `public, max-age=${Math.round(Math.min(ttl, 600_000) / 1000)}`,
      })
      .send(cache.xml);
  });
}
