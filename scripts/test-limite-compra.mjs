// Pruebas de src/lib/limiteCompra.ts. Ejecutar: node scripts/test-limite-compra.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CANTIDAD_MAX_POR_COMPRA, maxPorCompra, permiteSobreStock, unidadesDelProducto, cupoRestante } from "../src/lib/limiteCompra.ts";

test("el tope es 99", () => assert.equal(CANTIDAD_MAX_POR_COMPRA, 99));

test("suma líneas del mismo producto y excluye combos", () => {
  const items = [
    { id: "a", qty: 2, lineId: "a|x" },
    { id: "a", qty: 1, lineId: "a|y" },
    { id: "a", qty: 4, lineId: "a|c", comboId: "c1" },
    { id: "b", qty: 99, lineId: "b" },
  ];
  assert.equal(unidadesDelProducto(items, "a"), 3);
  assert.equal(cupoRestante(items, "a"), 96);
  assert.equal(cupoRestante(items, "b"), 0);
  assert.equal(cupoRestante(items, "zzz"), 99);
});

test("exceptoLineId no cuenta la línea que se está editando", () => {
  const items = [{ id: "a", qty: 3, lineId: "a|x" }, { id: "a", qty: 1, lineId: "a|y" }];
  assert.equal(cupoRestante(items, "a", "a|x"), 98);
});

test("nunca devuelve negativo (carrito con más de 99)", () => {
  assert.equal(cupoRestante([{ id: "a", qty: 120, lineId: "a" }], "a"), 0);
});

test("el tope de 99 y el pedido sobre el stock valen para todos los productos", () => {
  for (const id of ["0fad1859-f6e3-4e7f-a598-f14bb7143dcd", "otro", "cualquiera"]) {
    assert.equal(maxPorCompra(id), 99);
    assert.equal(permiteSobreStock(id), true);
  }
  assert.equal(cupoRestante([{ id: "otro", qty: 5, lineId: "l" }], "otro"), 94);
  assert.equal(cupoRestante([{ id: "otro", qty: 99, lineId: "l" }], "otro"), 0);
  // las piezas de un combo no cuentan
  assert.equal(cupoRestante([{ id: "otro", qty: 50, lineId: "c", comboId: "c1" }], "otro"), 99);
});

test("el servidor usa el mismo tope", () => {
  const src = readFileSync(new URL("../server/pagos.js", import.meta.url), "utf8");
  assert.equal(Number(src.match(/CANTIDAD_MAX_POR_COMPRA\s*=\s*(\d+)/)[1]), CANTIDAD_MAX_POR_COMPRA);
  assert.match(src, /permiteSobreStock\s*=\s*\(_?productId\)\s*=>\s*true/);
});
