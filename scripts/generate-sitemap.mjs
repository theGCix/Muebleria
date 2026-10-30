// scripts/generate-sitemap.mjs
// Se ejecuta antes de `vite build` (ver "build" en package.json) y genera:
//   public/sitemap.xml  → páginas fijas + categorías + productos activos + combos vigentes
//   public/robots.txt   → reglas + línea "Sitemap:" con la URL absoluta
// Variables (en Render, o en .env local):
//   SITE_URL (o VITE_APP_URL_PROD)  → URL pública del sitio, ej. https://www.gymmuebleria.pe
//   VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY → para leer productos/combos
// Nunca rompe el build: si falta algo, avisa y sigue con lo que pueda.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

if (!/^https:\/\//.test(SITE)) {
  console.warn("[sitemap] Define SITE_URL (https://...) en el entorno de build. Se omite sitemap.xml.");
  process.exit(0);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const entries = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/catalogo", changefreq: "daily", priority: "0.9" },
  { path: "/nosotros", changefreq: "monthly", priority: "0.6" },
  { path: "/proyectos", changefreq: "weekly", priority: "0.6" },
  { path: "/testimonios", changefreq: "weekly", priority: "0.6" },
  { path: "/envios", changefreq: "yearly", priority: "0.3" },
  { path: "/terminos", changefreq: "yearly", priority: "0.3" },
  { path: "/privacidad", changefreq: "yearly", priority: "0.3" },
];

// Categorías: se leen de src/lib/categories.ts para no duplicar la lista
try {
  const src = readFileSync(resolve(root, "src/lib/categories.ts"), "utf8");
  const slugs = new Set([...src.matchAll(/^\s{4}slug:\s*"([a-z0-9-]+)"/gm)].map((m) => m[1]));
  for (const slug of slugs) entries.push({ path: `/categoria/${slug}`, changefreq: "weekly", priority: "0.8" });
} catch (e) {
  console.warn("[sitemap] No pude leer las categorías:", e.message);
}

async function sb(query) {
  const res = await fetch(`${SB_URL}/rest/v1/${query}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

if (SB_URL && SB_KEY) {
  try {
    const productos = await sb("products?select=id,created_at&activo=eq.true&order=created_at.desc&limit=5000");
    for (const p of productos)
      entries.push({ path: `/product/${p.id}`, lastmod: p.created_at, changefreq: "weekly", priority: "0.8" });
    console.log(`[sitemap] ${productos.length} productos`);
  } catch (e) {
    console.warn("[sitemap] No pude leer productos:", e.message);
  }
  try {
    const now = new Date().toISOString();
    const combos = await sb(
      `combos?select=id,created_at,vence_el&activo=eq.true&or=(vence_el.is.null,vence_el.gt.${now})&limit=1000`,
    );
    for (const c of combos)
      entries.push({ path: `/combo/${c.id}`, lastmod: c.created_at, changefreq: "weekly", priority: "0.7" });
    console.log(`[sitemap] ${combos.length} combos`);
  } catch (e) {
    console.warn("[sitemap] No pude leer combos:", e.message);
  }
} else {
  console.warn("[sitemap] Sin credenciales de Supabase: solo páginas fijas y categorías.");
}

const urls = entries.map(
  (e) =>
    `  <url>\n    <loc>${esc(SITE + e.path)}</loc>\n` +
    (e.lastmod ? `    <lastmod>${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>\n` : "") +
    `    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
);
writeFileSync(
  resolve(root, "public/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
);

const robotsPath = resolve(root, "public/robots.txt");
let robots = existsSync(robotsPath) ? readFileSync(robotsPath, "utf8") : "User-agent: *\nAllow: /\n";
robots = robots.replace(/^Sitemap:.*\n?/gim, "").trimEnd() + `\n\nSitemap: ${SITE}/sitemap.xml\n`;
writeFileSync(robotsPath, robots);
console.log(`[sitemap] ${entries.length} URLs → public/sitemap.xml`);
