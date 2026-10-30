// Ejecutar: node --test server/feed.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { construirFeed, itemDe, imagenesDe, preciosDe, registerFeed, xml } from "./feed.js";

const SITIO = "https://tienda.test";
const AHORA = Date.parse("2026-10-30T12:00:00Z");

const prod = (extra = {}) => ({
  id: "p1", nombre: "Sofá Londres", descripcion: "Sofá de madera", precio: 1500, descuento_porcentaje: null,
  oferta_vence_el: null, stock: 3, sku: "SOF-1", categoria: "muebles", material_base: "Madera",
  imagenes: [{ public_id: "a/b" }, { url: "https://x.pe/2.jpg" }], ...extra,
});

test("item con todos los campos obligatorios de Google y moneda PEN", () => {
  const it = itemDe(prod(), SITIO, "demo", AHORA);
  for (const t of ["g:id", "g:title", "g:description", "g:link", "g:image_link", "g:availability", "g:price", "g:brand", "g:condition"])
    assert.match(it, new RegExp(`<${t}>`), t);
  assert.match(it, /<g:price>1500\.00 PEN<\/g:price>/);
  assert.match(it, /<g:link>https:\/\/tienda\.test\/product\/p1<\/g:link>/);
  assert.match(it, /<g:availability>in_stock<\/g:availability>/);
  assert.match(it, /<g:identifier_exists>no<\/g:identifier_exists>/);
  assert.match(it, /<g:mpn>SOF-1<\/g:mpn>/);
  assert.match(it, /<g:title>Sofá Londres - Madera<\/g:title>/);
  assert.match(it, /<g:product_type>Muebles<\/g:product_type>/);
  assert.doesNotMatch(it, /sale_price/);
});

test("imágenes: JPG sin deformar, primera como principal y el resto como adicionales", () => {
  const imgs = imagenesDe(prod(), "demo");
  assert.equal(imgs[0], "https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,q_auto,f_jpg/a/b");
  const it = itemDe(prod(), SITIO, "demo", AHORA);
  assert.match(it, /<g:image_link>https:\/\/res\.cloudinary\.com\/demo[^<]*<\/g:image_link>/);
  assert.match(it, /<g:additional_image_link>https:\/\/x\.pe\/2\.jpg<\/g:additional_image_link>/);
  assert.deepEqual(imagenesDe({ imagen_public_id: "z" }, ""), []); // sin nombre de nube no se inventa una URL
  assert.deepEqual(imagenesDe({ imagen_url: "javascript:alert(1)" }, "demo"), []);
});

test("oferta vigente: sale_price y vigencia; oferta vencida: solo precio normal", () => {
  const viva = itemDe(prod({ descuento_porcentaje: 10, oferta_vence_el: "2026-11-30T00:00:00Z" }), SITIO, "demo", AHORA);
  assert.match(viva, /<g:price>1500\.00 PEN<\/g:price>/);
  assert.match(viva, /<g:sale_price>1350\.00 PEN<\/g:sale_price>/);
  assert.match(viva, /<g:sale_price_effective_date>2026-10-30T12:00:00\.000Z\/2026-11-30T00:00:00\.000Z</);
  const vencida = itemDe(prod({ descuento_porcentaje: 10, oferta_vence_el: "2026-01-01T00:00:00Z" }), SITIO, "demo", AHORA);
  assert.doesNotMatch(vencida, /sale_price/);
  assert.equal(preciosDe({ precio: 100, descuento_porcentaje: 20, oferta_vence_el: null }, AHORA).oferta, 80);
});

test("sin stock → out_of_stock; sin stock definido → in_stock", () => {
  assert.match(itemDe(prod({ stock: 0 }), SITIO, "demo", AHORA), /out_of_stock/);
  assert.match(itemDe(prod({ stock: null }), SITIO, "demo", AHORA), /in_stock/);
});

test("omite productos sin imagen o con precio inválido, y deduplica ids", () => {
  const f = construirFeed(
    SITIO,
    [prod(), prod({ id: "p2", imagenes: [], imagen_url: null }), prod({ id: "p3", precio: 0 }), prod({ id: "p1" })],
    "demo", AHORA,
  );
  assert.equal(f.total, 1);
  assert.equal(f.omitidos, 2);
  assert.equal((f.xml.match(/<item>/g) ?? []).length, 1);
});

test("escapa XML, quita caracteres de control y recorta título (150) y descripción (5000)", () => {
  assert.equal(xml("a&b<c>\u0001d"), "a&amp;b&lt;c&gt;d");
  const it = itemDe(prod({ nombre: "N".repeat(400), descripcion: "D & <b>" + "x".repeat(6000) }), SITIO, "demo", AHORA);
  assert.ok(it.match(/<g:title>([^<]*)<\/g:title>/)[1].length <= 150);
  assert.ok(it.match(/<g:description>([^<]*)<\/g:description>/)[1].length <= 5100);
  assert.match(it, /D &amp; &lt;b&gt;/);
});

test("descripción vacía usa un texto por defecto (campo obligatorio)", () => {
  assert.match(itemDe(prod({ descripcion: null }), SITIO, "demo", AHORA), /<g:description>Sofá Londres \(Muebles\) fabricado a pedido/);
});

/* ───────── endpoint ───────── */
function fakeSupabase(tabla, llamadas = []) {
  return { from() { const b = { select() { return b; }, eq() { return b; }, order() { return b; },
    range(a, z) { llamadas.push([a, z]); return Promise.resolve(tabla(a, z)); } }; return b; } };
}
function montar(sb) {
  let handler;
  registerFeed({ app: { get: (_r, _l, h) => { handler = h; } }, supabaseAdmin: sb, rateLimit: () => (_q, _s, n) => n() });
  return async () => {
    const res = { code: 200, headers: {}, body: "" };
    res.status = (c) => { res.code = c; return res; };
    res.set = (h, v) => { Object.assign(res.headers, typeof h === "string" ? { [h]: v } : h); return res; };
    res.type = (t) => { res.headers["Content-Type"] = t; return res; };
    res.send = (b) => { res.body = b; return res; };
    await handler({}, res);
    return res;
  };
}
const conEntorno = (vars, fn) => async () => {
  const antes = {}; for (const k of Object.keys(vars)) { antes[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  const w = console.warn; console.warn = () => {};
  try { await fn(); } finally { console.warn = w; for (const k of Object.keys(antes)) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; } }
};

test("endpoint: 200 con XML, pagina y usa caché", conEntorno({ SITE_URL: SITIO, CLOUDINARY_CLOUD_NAME: "demo", FEED_TTL_SECONDS: "600" }, async () => {
  const llamadas = [];
  const filas = (n, pre) => Array.from({ length: n }, (_, i) => prod({ id: `${pre}${i}` }));
  const pedir = montar(fakeSupabase((a) => ({ data: a === 0 ? filas(1000, "a") : filas(5, "b"), error: null }), llamadas));
  const r = await pedir();
  assert.equal(r.code, 200);
  assert.match(r.headers["Content-Type"], /application\/xml/);
  assert.equal((r.body.match(/<item>/g) ?? []).length, 1005);
  const n = llamadas.length;
  await pedir();
  assert.equal(llamadas.length, n);
}));

test("endpoint: BD caída sin caché → 503 (nunca un feed vacío)", conEntorno({ SITE_URL: SITIO, CLOUDINARY_CLOUD_NAME: "demo" }, async () => {
  const r = await montar(fakeSupabase(() => ({ data: null, error: { message: "boom" } })))();
  assert.equal(r.code, 503);
  assert.doesNotMatch(r.body, /<item>/);
}));

test("endpoint: BD caída después de una lectura buena → conserva el feed anterior", conEntorno({ SITE_URL: SITIO, CLOUDINARY_CLOUD_NAME: "demo", FEED_TTL_SECONDS: "0" }, async () => {
  let caida = false;
  const pedir = montar(fakeSupabase(() => (caida ? { data: null, error: { message: "boom" } } : { data: [prod()], error: null })));
  const a = await pedir(); caida = true; const b = await pedir();
  assert.equal(a.code, 200); assert.equal(b.code, 200);
  assert.equal((b.body.match(/<item>/g) ?? []).length, 1);
}));

test("endpoint: sin SITE_URL → 503 con mensaje claro", conEntorno({ SITE_URL: undefined, VITE_APP_URL_PROD: undefined, FRONTEND_URL: undefined }, async () => {
  const r = await montar(fakeSupabase(() => ({ data: [], error: null })))();
  assert.equal(r.code, 503);
  assert.match(r.body, /SITE_URL/);
}));
