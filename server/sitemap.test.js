// Ejecutar: node --test server/sitemap.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { construirSitemap, registerSitemap, CATEGORIAS } from "./sitemap.js";

const SITIO = "https://tienda.test";

/** Supabase simulado: cada tabla es una función (columnas, desde, hasta) => { data, error }. */
function fakeSupabase(tablas, llamadas = []) {
  return {
    from(tabla) {
      const q = { tabla, columnas: "" };
      const b = {
        select(c) { q.columnas = c; return b; },
        eq() { return b; },
        or() { return b; },
        order() { return b; },
        range(a, z) {
          llamadas.push({ tabla, columnas: q.columnas, a, z });
          return Promise.resolve(tablas[tabla](q.columnas, a, z));
        },
      };
      return b;
    },
  };
}

const filas = (n, prefijo, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefijo}${i}`, created_at: "2026-01-02T00:00:00Z", ...extra }));

/** Monta la ruta con un `app` falso y devuelve una función que simula una petición GET. */
function montar(supabase) {
  let handler;
  const app = { get: (_ruta, _lim, h) => { handler = h; } };
  registerSitemap({ app, supabaseAdmin: supabase, rateLimit: () => (_q, _s, n) => n() });
  return async () => {
    const res = { code: 200, headers: {}, body: "" };
    res.status = (c) => { res.code = c; return res; };
    res.set = (h) => { Object.assign(res.headers, h); return res; };
    res.type = (t) => { res.headers["Content-Type"] = t; return res; };
    res.send = (b) => { res.body = b; return res; };
    await handler({}, res);
    return res;
  };
}

function entorno(vars) {
  const antes = {};
  for (const k of Object.keys(vars)) { antes[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  return () => { for (const k of Object.keys(antes)) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; } };
}

test("construirSitemap escapa caracteres XML y omite lastmod inválido", () => {
  const xml = construirSitemap(SITIO, [
    { path: "/a?x=1&y=2", lastmod: "2026-03-04T10:00:00Z", changefreq: "weekly", priority: "0.5" },
    { path: "/b", lastmod: "no-es-fecha", changefreq: "weekly", priority: "0.5" },
  ]);
  assert.match(xml, /<loc>https:\/\/tienda\.test\/a\?x=1&amp;y=2<\/loc>/);
  assert.match(xml, /<lastmod>2026-03-04<\/lastmod>/);
  assert.equal((xml.match(/<lastmod>/g) ?? []).length, 1);
});

test("incluye páginas fijas, categorías, productos y combos; pagina más de 1000 filas", async () => {
  const restaurar = entorno({ SITE_URL: SITIO, SITEMAP_TTL_SECONDS: "600" });
  const llamadas = [];
  const sb = fakeSupabase(
    {
      products: (_c, a) => ({ data: a === 0 ? filas(1000, "p") : a === 1000 ? filas(1000, "q") : filas(500, "r"), error: null }),
      combos: () => ({ data: filas(2, "c"), error: null }),
    },
    llamadas,
  );
  const res = await montar(sb)();
  restaurar();
  assert.equal(res.code, 200);
  assert.match(res.headers["Content-Type"], /application\/xml/);
  assert.equal((res.body.match(/\/product\//g) ?? []).length, 2500);
  assert.equal((res.body.match(/\/combo\//g) ?? []).length, 2);
  for (const slug of CATEGORIAS) assert.match(res.body, new RegExp(`/categoria/${slug}<`));
  assert.match(res.body, /<loc>https:\/\/tienda\.test\/<\/loc>/);
  assert.equal(llamadas.filter((l) => l.tabla === "products").length, 3);
});

test("si falta updated_at, reintenta solo con created_at", async () => {
  const restaurar = entorno({ SITE_URL: SITIO });
  const llamadas = [];
  const sb = fakeSupabase(
    {
      products: (cols) =>
        cols.includes("updated_at")
          ? { data: null, error: { code: "42703", message: "column products.updated_at does not exist" } }
          : { data: filas(3, "p"), error: null },
      combos: () => ({ data: [], error: null }),
    },
    llamadas,
  );
  const res = await montar(sb)();
  restaurar();
  assert.equal((res.body.match(/\/product\//g) ?? []).length, 3);
  assert.match(res.body, /<lastmod>2026-01-02<\/lastmod>/);
  assert.ok(llamadas.some((l) => l.tabla === "products" && !l.columnas.includes("updated_at")));
});

test("usa updated_at como lastmod cuando existe", async () => {
  const restaurar = entorno({ SITE_URL: SITIO });
  const sb = fakeSupabase({
    products: () => ({ data: filas(1, "p", { updated_at: "2026-09-09T00:00:00Z" }), error: null }),
    combos: () => ({ data: [], error: null }),
  });
  const res = await montar(sb)();
  restaurar();
  assert.match(res.body, /product\/p0<\/loc>\s*<lastmod>2026-09-09<\/lastmod>/);
});

test("la caché evita volver a consultar la base de datos", async () => {
  const restaurar = entorno({ SITE_URL: SITIO, SITEMAP_TTL_SECONDS: "600" });
  const llamadas = [];
  const sb = fakeSupabase(
    { products: () => ({ data: filas(1, "p"), error: null }), combos: () => ({ data: [], error: null }) },
    llamadas,
  );
  const pedir = montar(sb);
  await pedir();
  const primeras = llamadas.length;
  await pedir();
  restaurar();
  assert.equal(llamadas.length, primeras);
});

test("peticiones simultáneas comparten una sola lectura", async () => {
  const restaurar = entorno({ SITE_URL: SITIO });
  const llamadas = [];
  const sb = fakeSupabase(
    { products: () => ({ data: filas(1, "p"), error: null }), combos: () => ({ data: [], error: null }) },
    llamadas,
  );
  const pedir = montar(sb);
  await Promise.all([pedir(), pedir(), pedir()]);
  restaurar();
  assert.equal(llamadas.filter((l) => l.tabla === "products").length, 1);
});

test("si la base de datos cae y no hay caché, responde páginas fijas y categorías (200)", async () => {
  const restaurar = entorno({ SITE_URL: SITIO });
  const originalWarn = console.warn; console.warn = () => {};
  const sb = fakeSupabase({
    products: () => ({ data: null, error: { message: "connection refused" } }),
    combos: () => ({ data: null, error: { message: "connection refused" } }),
  });
  const res = await montar(sb)();
  console.warn = originalWarn;
  restaurar();
  assert.equal(res.code, 200);
  assert.doesNotMatch(res.body, /\/product\//);
  assert.match(res.body, /\/catalogo</);
});

test("si la base cae después de una lectura buena, conserva la versión completa", async () => {
  const restaurar = entorno({ SITE_URL: SITIO, SITEMAP_TTL_SECONDS: "0" }); // TTL 0 = siempre vence
  const originalWarn = console.warn; console.warn = () => {};
  let caida = false;
  const sb = fakeSupabase({
    products: () => (caida ? { data: null, error: { message: "boom" } } : { data: filas(2, "p"), error: null }),
    combos: () => ({ data: [], error: null }),
  });
  const pedir = montar(sb);
  const buena = await pedir();
  caida = true;
  const durante = await pedir();
  console.warn = originalWarn;
  restaurar();
  assert.equal((buena.body.match(/\/product\//g) ?? []).length, 2);
  assert.equal((durante.body.match(/\/product\//g) ?? []).length, 2);
});

test("sin SITE_URL responde 503 con un mensaje claro", async () => {
  const restaurar = entorno({ SITE_URL: undefined, VITE_APP_URL_PROD: undefined, FRONTEND_URL: undefined });
  const sb = fakeSupabase({ products: () => ({ data: [], error: null }), combos: () => ({ data: [], error: null }) });
  const res = await montar(sb)();
  restaurar();
  assert.equal(res.code, 503);
  assert.match(res.body, /SITE_URL/);
});
