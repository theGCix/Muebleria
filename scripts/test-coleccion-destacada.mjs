// Pruebas de src/lib/coleccionDestacada.ts. Ejecutar: node scripts/test-coleccion-destacada.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { offsetCircular, poseTarjeta, mover, elegirAutomaticas } from "../src/lib/coleccionDestacada.ts";

test("offsetCircular: la actual es 0 y las vecinas ±1, dando la vuelta", () => {
  assert.equal(offsetCircular(2, 2, 5), 0);
  assert.equal(offsetCircular(3, 2, 5), 1);
  assert.equal(offsetCircular(1, 2, 5), -1);
  assert.equal(offsetCircular(0, 4, 5), 1);
  assert.equal(offsetCircular(4, 0, 5), -1);
  assert.equal(offsetCircular(0, 0, 0), 0);
});

test("offsetCircular: con 4 piezas la opuesta queda a 2 (oculta); con 2 solo hay una vecina", () => {
  assert.equal(Math.abs(offsetCircular(2, 0, 4)), 2);
  assert.equal(offsetCircular(1, 0, 2), 1);
});

test("poseTarjeta: centro grande y visible, vecinas giradas hacia el centro, lejanas ocultas", () => {
  const c = poseTarjeta(0);
  assert.deepEqual([c.x, c.rot, c.escala, c.opacidad], [0, 0, 1.1, 1]);
  const d = poseTarjeta(1);
  const i = poseTarjeta(-1);
  assert.ok(d.x > 0 && i.x < 0 && d.rot < 0 && i.rot > 0);
  assert.ok(d.opacidad === 1 && d.velo > 0 && c.velo === 0 && d.escala < 1);
  assert.equal(poseTarjeta(2).opacidad, 0);
  assert.equal(poseTarjeta(-3).opacidad, 0);
  assert.ok(c.z > d.z && d.z > poseTarjeta(2).z);
});

test("mover: da la vuelta en ambos sentidos", () => {
  assert.equal(mover(4, 1, 5), 0);
  assert.equal(mover(0, -1, 5), 4);
  assert.equal(mover(2, 1, 5), 3);
  assert.equal(mover(0, 1, 0), 0);
});

test("elegirAutomaticas: salta las 4 primeras si alcanza y no repite; si no, toma las más recientes", () => {
  const todo = Array.from({ length: 17 }, (_, k) => k);
  assert.deepEqual(elegirAutomaticas(todo), [4, 5, 6, 7, 8]);
  assert.deepEqual(elegirAutomaticas(todo.slice(0, 7)), [0, 1, 2, 3, 4]);
  assert.deepEqual(elegirAutomaticas(todo.slice(0, 8)), [4, 5, 6, 7]);
  assert.deepEqual(elegirAutomaticas([], 5), []);
  assert.deepEqual(elegirAutomaticas(todo, 0), []);
});
