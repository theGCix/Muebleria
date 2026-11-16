// Pruebas de src/lib/liquidacion.ts. Ejecutar: node --test scripts/test-liquidacion.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import {
  precioConDescuento, descuentoDesdePrecio, spansBanners, agruparPorCategoria, selloEnvio, numeroBanner,
} from "../src/lib/liquidacion.ts";

test("precio con descuento: igual que el servidor (referencias del banner)", () => {
  assert.equal(precioConDescuento(2340, 38), 1450.8);
  assert.equal(precioConDescuento(2499, 24), 1899.24);
  assert.equal(precioConDescuento(1000, 10), 900);
});

test("descuento entero desde un precio objetivo", () => {
  assert.equal(descuentoDesdePrecio(2340, 1459), 38);
  assert.equal(descuentoDesdePrecio(3170, 2049), 35);
  assert.equal(descuentoDesdePrecio(1000, 1000), null);
  assert.equal(descuentoDesdePrecio(1000, 1200), null);
  assert.equal(descuentoDesdePrecio(1000, 0), null);
  assert.equal(descuentoDesdePrecio(1000, 50), null); // 95 % > 90 %
  assert.equal(descuentoDesdePrecio(1000, 999), null); // 0 %
});

test("columnas sin huecos para 0 a 5 banners (y tope en 5)", () => {
  assert.deepEqual(spansBanners(0), []);
  assert.deepEqual(spansBanners(1), [6]);
  assert.deepEqual(spansBanners(2), [3, 3]);
  assert.deepEqual(spansBanners(3), [2, 2, 2]);
  assert.deepEqual(spansBanners(4), [3, 3, 3, 3]);
  assert.deepEqual(spansBanners(5), [2, 2, 2, 3, 3]);
  assert.deepEqual(spansBanners(9), [2, 2, 2, 3, 3]);
  for (let n = 1; n <= 5; n++) {
    const s = spansBanners(n);
    assert.equal(s.length, n);
    // cada fila suma 6
    let fila = 0;
    for (const c of s) { fila += c; if (fila === 6) fila = 0; assert.ok(fila < 6); }
    assert.equal(fila, 0);
  }
});

test("los 5 más recientes por categoría", () => {
  const mk = (id, categoria, dia) => ({ id, categoria, created_at: `2026-11-${String(dia).padStart(2, "0")}T10:00:00Z` });
  const items = [1, 2, 3, 4, 5, 6, 7].map((d) => mk(`m${d}`, "muebles", d)).concat([mk("c1", "comedores", 3)]);
  const g = agruparPorCategoria(items);
  assert.deepEqual(g.muebles.map((x) => x.id), ["m7", "m6", "m5", "m4", "m3"]);
  assert.deepEqual(g.comedores.map((x) => x.id), ["c1"]);
  assert.equal(g.recamaras, undefined);
});

test("sello de envío", () => {
  assert.deepEqual(selloEnvio("gratis"), { titulo: "DELIVERY GRATIS", detalle: "A TODA LIMA METROPOLITANA" });
  assert.equal(selloEnvio("ninguno"), null);
  assert.equal(selloEnvio("descuento", null), null);
  assert.equal(selloEnvio("descuento", 20).detalle, "S/ 20 MENOS EN TU DELIVERY");
  assert.equal(selloEnvio("descuento", 12.5).detalle, "S/ 12.50 MENOS EN TU DELIVERY");
});

test("número del precio", () => {
  assert.equal(numeroBanner(1899), "1,899");
  assert.equal(numeroBanner(2049), "2,049");
  assert.equal(numeroBanner(999), "999");
  assert.equal(numeroBanner(1450.8), "1,450.80");
});
