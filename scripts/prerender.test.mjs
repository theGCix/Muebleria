// Ejecutar: node --test scripts/prerender.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { inyectar, esc, ofertaInfo, imagenesDe, paginaProducto, paginaCombo, noscriptListado } from "./prerender-lib.mjs";

const PLANTILLA = `<!DOCTYPE html>
<html lang="es-PE">
  <head>
    <meta charset="UTF-8" />
    <title>G&M Mueblería — Muebles artesanales de madera natural</title>
    <meta name="description" content="Descripción genérica" />
    <meta property="og:title" content="Título genérico" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://t.pe/og-default.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="genérica" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://t.pe/og-default.jpg" />
    <script type="application/ld+json">{"@type":"FurnitureStore"}</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>`;

const cats = [{ slug: "muebles", nombre: "Muebles", descripcion: "x" }];
const ctx = { sitio: "https://t.pe", cloud: "demo", categorias: cats };
const producto = {
  id: "11111111-1111-1111-1111-111111111111", nombre: 'Sofá "Londres" <3 plazas>', descripcion: "Sofá de madera & tela",
  precio: 1000, descuento_porcentaje: 10, oferta_vence_el: null, categoria: "muebles", material_base: "Madera",
  stock: 4, sku: "SOF-1", imagenes: [{ public_id: "a/b", url: "x" }],
};

test("esc no duplica entidades ya escapadas y escapa lo peligroso", () => {
  assert.equal(esc("G&M"), "G&amp;M");
  assert.equal(esc("G&amp;M"), "G&amp;M");
  assert.equal(esc('<a href="x">'), "&lt;a href=&quot;x&quot;&gt;");
});

test("inyectar cambia título y metas en sitio y guarda el original para head.ts", () => {
  const html = inyectar(PLANTILLA, paginaProducto(producto, ctx).page);
  assert.match(html, /<title>Sofá &quot;Londres&quot; &lt;3 plazas&gt; · Muebles · Madera \| G&amp;M Mueblería<\/title>/);
  assert.match(html, /data-gm-base-title="G&amp;M Mueblería — Muebles artesanales de madera natural"/);
  // la meta description existente se edita en sitio (no se duplica) y recuerda el valor genérico
  assert.equal((html.match(/name="description"/g) ?? []).length, 1);
  assert.match(html, /<meta data-gm-orig="Descripción genérica" name="description" content="Sofá de madera &amp; tela" \/>/);
  assert.equal((html.match(/property="og:title"/g) ?? []).length, 1);
  assert.match(html, /data-gm-orig="Título genérico"/);
});

test("quita las medidas de og:image genéricas y pone la imagen del producto", () => {
  const html = inyectar(PLANTILLA, paginaProducto(producto, ctx).page);
  assert.doesNotMatch(html, /og:image:width|og:image:height|og:image:alt/);
  assert.match(html, /property="og:image"[^>]*content="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/w_900,q_80,f_auto,h_900\/a\/b"/);
});

test("las etiquetas nuevas (canonical, og:url, JSON-LD) llevan data-gm-head y no se duplican", () => {
  const html = inyectar(PLANTILLA, paginaProducto(producto, ctx).page);
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/t\.pe\/product\/1111[^"]*" data-gm-head="1" \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/t\.pe\/product\/[^"]*" data-gm-head="1" \/>/);
  const lds = html.match(/<script type="application\/ld\+json"[^>]*>/g) ?? [];
  assert.equal(lds.length, 2); // el FurnitureStore global + el Product
  assert.equal(lds.filter((l) => l.includes("data-gm-head")).length, 1);
});

test("JSON-LD: precio con descuento, disponibilidad y sin romper el <script>", () => {
  const p = { ...producto, nombre: "Mesa </script><b>", stock: 0 };
  const html = inyectar(PLANTILLA, paginaProducto(p, ctx).page);
  const ld = html.match(/<script type="application\/ld\+json" data-gm-head="1">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(ld, /<\/script>/);
  const obj = JSON.parse(ld);
  assert.equal(obj.offers.price, "900.00");
  assert.equal(obj.offers.availability, "https://schema.org/OutOfStock");
  assert.equal(obj.sku, "SOF-1");
});

test("ofertaInfo ignora descuentos vencidos", () => {
  assert.equal(ofertaInfo({ precio: 100, descuento_porcentaje: 20, oferta_vence_el: "2020-01-01" }).precioFinal, 100);
  assert.equal(ofertaInfo({ precio: 100, descuento_porcentaje: 20, oferta_vence_el: null }).precioFinal, 80);
});

test("imagenesDe respeta el orden: galería → public_id → url", () => {
  assert.deepEqual(imagenesDe({ imagenes: [{ url: "u1" }, { url: "u2" }] }, "c"), ["u1", "u2"]);
  assert.match(imagenesDe({ imagen_public_id: "p" }, "c")[0], /res\.cloudinary\.com\/c\/.*\/p$/);
  assert.deepEqual(imagenesDe({ imagen_url: "https://x/y.jpg" }, ""), ["https://x/y.jpg"]);
  assert.deepEqual(imagenesDe({}, "c"), []);
});

test("<noscript> con contenido escapado antes del #root, y enlaces a productos en el listado", () => {
  const html = inyectar(PLANTILLA, paginaProducto(producto, ctx).page);
  assert.match(html, /<noscript><main>[\s\S]*<h1>Sofá &quot;Londres&quot; &lt;3 plazas&gt;<\/h1>[\s\S]*S\/ 900\.00[\s\S]*<\/noscript>\s*<div id="root"><\/div>/);
  const lista = noscriptListado({ titulo: "Catálogo", productos: [{ id: "a1", nombre: "Mesa" }], categorias: cats });
  assert.match(lista, /<a href="\/product\/a1">Mesa<\/a>/);
  assert.match(lista, /<a href="\/categoria\/muebles">Muebles<\/a>/);
});

test("combo: usa precio_combo e incluye las piezas", () => {
  const combo = {
    id: "c1", nombre: "Sala completa", descripcion: null, precio_combo: 2500, imagen_url: "https://x/c.jpg",
    combo_items: [{ products: { nombre: "Sofá" } }, { products: { nombre: "Mesa" } }],
  };
  const { ruta, page } = paginaCombo(combo, ctx);
  assert.equal(ruta, "/combo/c1");
  assert.match(page.description, /Sofá, Mesa/);
  assert.equal(page.jsonLd[0].offers.price, "2500.00");
  assert.match(inyectar(PLANTILLA, page), /<li>Sofá<\/li><li>Mesa<\/li>/);
});

test("el inicio conserva sus metas: solo añade <noscript>", () => {
  const html = inyectar(PLANTILLA, { noscript: noscriptListado({ titulo: "Inicio", productos: [], categorias: cats }) });
  assert.match(html, /<title>G&M Mueblería — Muebles artesanales de madera natural<\/title>/);
  assert.match(html, /content="Descripción genérica"/);
  assert.doesNotMatch(html, /data-gm-orig/);
  assert.match(html, /<noscript>/);
});
