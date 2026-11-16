// Pruebas de src/lib/limiteCompra.ts. Ejecutar: node scripts/test-limite-compra.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CANTIDAD_MAX_POR_COMPRA, unidadesDelProducto, cupoRestante } from "../src/lib/limiteCompra.ts";

test("el tope es 5", () => assert.equal(CANTIDAD_MAX_POR_COMPRA, 5));

test("suma líneas del mismo producto y excluye combos", () => {
  const items = [
    { id: "a", qty: 2, lineId: "a|x" },
    { id: "a", qty: 1, lineId: "a|y" },
    { id: "a", qty: 4, lineId: "a|c", comboId: "c1" },
    { id: "b", qty: 5, lineId: "b" },
  ];
  assert.equal(unidadesDelProducto(items, "a"), 3);
  assert.equal(cupoRestante(items, "a"), 2);
  assert.equal(cupoRestante(items, "b"), 0);
  assert.equal(cupoRestante(items, "zzz"), 5);
});

test("exceptoLineId no cuenta la línea que se está editando", () => {
  const items = [{ id: "a", qty: 3, lineId: "a|x" }, { id: "a", qty: 1, lineId: "a|y" }];
  assert.equal(cupoRestante(items, "a", "a|x"), 4);
});

test("nunca devuelve negativo (carrito antiguo con más de 5)", () => {
  assert.equal(cupoRestante([{ id: "a", qty: 9, lineId: "a" }], "a"), 0);
});

test("el servidor usa el mismo tope", () => {
  const src = readFileSync(new URL("../server/pagos.js", import.meta.url), "utf8");
  const m = src.match(/CANTIDAD_MAX_POR_COMPRA\s*=\s*(\d+)/);
  assert.ok(m, "pagos.js debe declarar CANTIDAD_MAX_POR_COMPRA");
  assert.equal(Number(m[1]), CANTIDAD_MAX_POR_COMPRA);
});
