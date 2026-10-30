// scripts/prerender.mjs
// Se ejecuta DESPUÉS de `vite build` (ver "build" en package.json). Para cada página pública escribe
// un HTML propio con título, descripción, canonical, Open Graph, JSON-LD y un resumen en <noscript>:
//   dist/product/<id>/index.html · dist/combo/<id>/index.html · dist/categoria/<slug>/index.html
//   dist/catalogo/index.html (y demás páginas fijas) · dist/index.html (inicio, con enlaces rastreables)
// Render sirve un archivo existente ANTES de aplicar el rewrite a /index.html, y entrega
// product/<id>/index.html tanto en /product/<id> como en /product/<id>/. La SPA funciona igual.
//
// Variables (las mismas del sitemap): SITE_URL o VITE_APP_URL_PROD, VITE_SUPABASE_URL,
// VITE_SUPABASE_PUBLISHABLE_KEY, VITE_CLOUDINARY_CLOUD_NAME.
// Nunca rompe el build: si algo falla, avisa y deja dist/ como estaba (la SPA sigue funcionando).
// Para desactivarlo: PRERENDER=0.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inyectar, leerCategorias, paginaProducto, paginaCombo, noscriptListado } from "./prerender-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

// .env local (en Render las variables ya vienen en process.env)
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SITE = (process.env.SITE_URL || process.env.VITE_APP_URL_PROD || "").trim().replace(/\/+$/, "");
const SB_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SB_KEY = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
const CLOUD = (process.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();

if (process.env.PRERENDER === "0") {
  console.log("[prerender] Desactivado (PRERENDER=0).");
  process.exit(0);
}
if (!/^https:\/\//.test(SITE)) {
  console.warn("[prerender] Define SITE_URL (https://...) en el build. Se omite el prerenderizado.");
  process.exit(0);
}
const plantillaPath = resolve(dist, "index.html");
if (!existsSync(plantillaPath)) {
  console.warn("[prerender] No existe dist/index.html (¿falló vite build?). Se omite.");
  process.exit(0);
}
const plantilla = readFileSync(plantillaPath, "utf8");

async function sbTodo(query) {
  const filas = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const sep = query.includes("?") ? "&" : "?";
    const res = await fetch(`${SB_URL}/rest/v1/${query}${sep}limit=1000&offset=${offset}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const lote = await res.json();
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas;
}

function escribir(ruta, html) {
  const destino = ruta === "/" ? plantillaPath : resolve(dist, `.${ruta}`, "index.html");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html);
}

try {
  let categorias = [];
  try {
    categorias = leerCategorias(readFileSync(resolve(root, "src/lib/categories.ts"), "utf8"));
  } catch (e) {
    console.warn("[prerender] No pude leer las categorías:", e.message);
  }

  let productos = [];
  let combos = [];
  if (SB_URL && SB_KEY) {
    try {
      productos = await sbTodo("products?select=*&activo=eq.true&order=created_at.desc");
    } catch (e) {
      console.warn("[prerender] No pude leer productos:", e.message);
    }
    try {
      const ahora = new Date().toISOString();
      combos = await sbTodo(
        `combos?select=*,combo_items(cantidad,products(nombre,imagenes,imagen_public_id,imagen_url))&activo=eq.true&or=(vence_el.is.null,vence_el.gt.${ahora})`,
      );
    } catch (e) {
      console.warn("[prerender] No pude leer combos:", e.message);
    }
  } else {
    console.warn("[prerender] Sin credenciales de Supabase: solo páginas fijas y categorías.");
  }

  const ctx = { sitio: SITE, cloud: CLOUD, categorias };
  let n = 0;

  for (const p of productos) {
    const { ruta, page } = paginaProducto(p, ctx);
    escribir(ruta, inyectar(plantilla, page));
    n++;
  }
  for (const c of combos) {
    const { ruta, page } = paginaCombo(c, ctx);
    escribir(ruta, inyectar(plantilla, page));
    n++;
  }

  const listaProductos = productos.map((p) => ({ id: p.id, nombre: p.nombre }));
  for (const c of categorias) {
    const propios = productos.filter((p) => p.categoria === c.slug).map((p) => ({ id: p.id, nombre: p.nombre }));
    escribir(
      `/categoria/${c.slug}`,
      inyectar(plantilla, {
        title: `${c.nombre} — G&M Mueblería`,
        description: c.descripcion,
        canonical: `${SITE}/categoria/${c.slug}`,
        noscript: noscriptListado({ titulo: c.nombre, descripcion: c.descripcion, productos: propios }),
      }),
    );
    n++;
  }

  // Páginas fijas (mismos títulos y descripciones que el head() de cada ruta)
  const fijas = [
    ["/catalogo", "Catálogo completo — G&M Mueblería", "Explora todos nuestros muebles: salas, comedores, recámaras, separadores de ambiente y accesorios.", true],
    ["/nosotros", "Nuestro taller — G&M Mueblería", "Conoce cómo fabricamos cada mueble en nuestro taller de Lima: madera tornillo seca y tratada, acabado a mano y control de calidad pieza por pieza."],
    ["/proyectos", "Proyectos — G&M Mueblería", "Piezas especiales e ideas nuevas que fabricamos en nuestro taller de Lima."],
    ["/testimonios", "Testimonios — G&M Mueblería", "Fotos reales y reseñas verificadas de clientes con sus muebles G&M."],
    ["/envios", "Envíos y entregas — G&M Mueblería", "Plazos de entrega en Lima y provincias, recojo en tienda y cómo coordinamos la entrega de tu mueble."],
    ["/terminos", "Términos y condiciones — G&M Mueblería", "Condiciones de compra, fabricación a pedido, pagos, garantía y cambios de G&M Mueblería."],
    ["/privacidad", "Política de privacidad — G&M Mueblería", "Qué datos recopilamos, para qué los usamos y cómo ejercer tus derechos sobre ellos."],
  ];
  for (const [ruta, title, description, conProductos] of fijas) {
    escribir(
      ruta,
      inyectar(plantilla, {
        title,
        description,
        canonical: `${SITE}${ruta}`,
        noscript: noscriptListado({
          titulo: title.replace(/ — G&M Mueblería$/, ""),
          descripcion: description,
          productos: conProductos ? listaProductos : [],
          categorias: conProductos ? categorias : [],
        }),
      }),
    );
    n++;
  }

  // Inicio: se conservan sus metas y se añaden enlaces rastreables a categorías y productos
  escribir(
    "/",
    inyectar(plantilla, {
      noscript: noscriptListado({
        titulo: "G&M Mueblería — Muebles artesanales de madera natural",
        descripcion: "Muebles de madera natural hechos a mano en Lima, con entrega a domicilio.",
        productos: listaProductos.slice(0, 60),
        categorias,
      }),
    }),
  );
  n++;

  console.log(`[prerender] ${n} páginas (${productos.length} productos, ${combos.length} combos, ${categorias.length} categorías).`);
} catch (e) {
  console.warn("[prerender] Falló, se deja dist/ como estaba:", e?.message ?? e);
}
